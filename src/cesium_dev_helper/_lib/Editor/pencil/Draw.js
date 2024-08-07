import { DrawingManager, EventManager, LayerManager } from "../../Manager";
import Graphics from "./Graphics";
import { CoordTransformer } from "../../Compute";
import { isValidCartesian3 } from "../../util/isValid";
import TurfUser from "../../Compute/TurfUser";
import * as Cesium from "cesium";

/**
 * Draw class for drawing entities with events on a Cesium viewer with event handling.
 * @class
 */
export default class Draw extends DrawingManager {
    constructor(viewer, StaticMap = {}) {
        if (!viewer) return;
        console.log('new Draw class');
        super(viewer);
        this.initLayer('Draw-drawLayer@henriFox')
        this.dfSt = StaticMap || undefined;//图片资源path
        this.$graphics = new Graphics(viewer, this._drawLayer);
        this.$coords = new CoordTransformer();
        this.$turfer = new TurfUser(viewer);
        this.defaultImageUrl = '';
        this.currentHandler = null;//方便在removeEventHandler剔除
    }

    initLayer(name) {
        const lM = new LayerManager(this.viewer)
        this._drawLayer = lM.addDatasourceByName(name);;//保证图层的唯一性
    }
    // --辅助函数-----------------------------------------
    // 获得屏幕位置的cartesian
    _getCartesian3FromPX/*pixel*/ = (position) => {
        return this.$coords.getCartesianFromScreenPosition(position, this.viewer);
    }
    // 给data设置动态属性 则实体options更改时重新render实体
    _setDynamic(data) {
        return new Cesium.CallbackProperty(() => {
            return data;
        }, false)
    }

    // 处理(展示)测量结果
    _measureResultHandle = (res) => {
        console.log('the measure result:', res.value, 'km');
    }

    _parseConfig(entityOption) {
        const { t_id, name, description/*可随意添加*/, datasource, ...rest } = entityOption;
        const parsedEntityOpt = {
            extraOption: {
                t_id,
                name,
                description,
            },
            graphicOption: rest,
            datasource: this._drawLayer,//指定特定图层
        }
        return parsedEntityOpt;
    }
    // 绘制动态实体(限制在本图层)-位置坐标为callbackProperty
    _startDynamicEntity = (typeOfEntity, entityOption, getNewPosition) => {
        if (typeof getNewPosition !== 'function') throw new Error('cannot get new position')
        try {
            // 配置解析
            const parsedEntityOpt = this._parseConfig(entityOption);
            let Entity = this.$graphics.createDynamicEntity(typeOfEntity, parsedEntityOpt, getNewPosition)
            return Entity;
        } catch (e) {
            console.error('sth is wrong after mouse left click :', e)
            return;
        };
    }

    // 更新 用于绘制实体的 配置选项的 坐标选项 
    _updatePos(options, newPos) {
        options.positions = newPos;
    }
    _updatePosByType(type, pickedPosCollection = [], newPickPos = new Cesium.Cartesian3(0, 0, 0), entityOptions = {}, isClose = true) {
        // --多边形闭合--
        if (isClose) {
            if (!type === 'point' || !type === 'polyline') {
                // 首尾相连
                pickedPosCollection.push(pickedPosCollection[0]);
                this._updatePos(entityOptions, pickedPosCollection);
            }
            // 只是为了闭合图形更新 提前返回
            return true;
        }

        // --多边形编辑--
        // 线段 
        if (type === 'polyline' && pickedPosCollection.length >= 2) {
            // 端点更新
            pickedPosCollection.pop();
            pickedPosCollection.push(newPickPos);

        }
        // 矩形(保持2个点)
        else if (type === 'rectangle') {
            if (pickedPosCollection.length === 1) {
                // 矩形 端点更新(增加)
                pickedPosCollection.push(newPickPos);
            } else {
                // 矩形 端点更新(替换已有点)
                pickedPosCollection[1] = newPickPos;
            }
        }
        // 圆形
        else if (type === 'ellipse') {
            // 检测到还没有创建圆的圆心
            if (pickedPosCollection.length === 0) return;
            // 缩放半径
            if (pickedPosCollection.length === 1) {
                const _center = pickedPosCollection[0];
                const _radius = Cesium.Cartesian3.distance(_center, newPickPos);
                const dynamicRadius = this._setDynamic(_radius);//每帧都调用
                entityOptions.semiMajorAxis = dynamicRadius
                entityOptions.semiMinorAxis = dynamicRadius
            }
        }
        // 其他 直接添加数据点
        else {
            pickedPosCollection.push(newPickPos);
        }
        // 更新实体的配置选项点坐标 
        this._updatePos(entityOptions, pickedPosCollection);
        return true;
    }

    // 核心
    /**
     * Draw an entity with event handling.
     * @param {String} Type - The type of the entity.
     * @param {Object} options - The options include extraOption and entityOptions.
     * @param {Function} pluginFunction - Optional plugin function for additional processing.
     * @returns {Cesium.Entity|null} - The created entity or null if viewer or options are not provided.
     */
    drawWithEvent(Type, options, pluginFunction) {
        console.log('drawWithEvent-type:', Type)
        if (!this.viewer || !options) return null;

        // --数据准备--
        const type = Type.toLowerCase()
        let $this = this
        let eM = new EventManager($this.viewer),
            // 收集click处的坐标
            pickedPosCollection = [],
            // 获取 ~新~ 事件handler程序 ,防止事件绑定间的冲突
            _handlers = eM.handler

        // register the handlers which is working 
        $this.currentHandler = _handlers;

        // 准备动态实体的数据
        options.positions = pickedPosCollection;
        if (!options.datasource) options.datasource = this._drawLayer // 默认添至的图层

        const getNewPosition = () => {
            // return pickedPosCollection[pickedPosCollection.length - 1];最后位置
            return pickedPosCollection//整体坐标
        }
        // --创建动态实体--
        let currentEntity = $this._startDynamicEntity(type, options, getNewPosition)
        console.log(currentEntity, 'currentEntity')


        // 特殊处理 
        function extra() { // 特殊情况的额外处理
            // 特殊处理:绘制两点直线
            if (options.straight && type === 'polyline' && pickedPosCollection.length == 2) {
                // 销毁事件处理程序 结束绘制
                _handlers.destroy();
                _handlers = null;
                // 绘制后的回调 
                if (typeof options.after === "function") {
                    options.after(currentEntity, $this._transformCartesianToWGS84(pickedPosCollection),);
                }
            }
        } extra()

        // --EVENT--
        // set callback function
        const afterLeftClick = (movement, pickedPos, pickedObj) => {   // left click
            // 点击处的直角坐标
            const cartesian = pickedPos;
            // 检查格式
            if (!cartesian || !isValidCartesian3(cartesian)) return;
            // 收集 点击处的地理坐标
            pickedPosCollection.push(cartesian); // 更新实体的坐标
           

            // test
            console.log('datasource-entities', this._drawLayer.entities.values)
            // console.log('entity', currentEntity)
            // console.log('positions', options.positions)
            // console.log('datasorces', this.viewer.dataSources)

        }
        const afterMouseMove = (movement) => { // mouse movement 
            let cartesian = $this._getCartesian3FromPX(movement.endPosition);
            // 持续更新坐标选项 动态实体会每帧读取
            if (!cartesian || !isValidCartesian3(cartesian)) return;
            // pickedPosCollection.push(cartesian);

            // test
            // console.log('mouse moving', cartesian)
        }
        const afterRightClick = (movement) => { // right click 

            // 更新图形
            const isClose = true;
            $this._updatePosByType(type, pickedPosCollection, {}, options, isClose);

            //开启测量功能
            if (options.measure) {
                let endPos/*右键点击处地理坐标*/ = $this._getCartesian3FromPX(movement.position);
                const res /*测量结果*/ = $this.$turfer.measureSimple(type, pickedPosCollection);
                $this._measureResultHandle({
                    /*...*/
                    entity: currentEntity,
                    value: res,
                    screenXY: movement.position,
                    cartoXY: endPos,
                });
            }


            // 结束绘制
            _handlers.destroy();
            _handlers = null;

            // callback with Entity and Positions
            if (typeof options.after === "function") {
                options.after(currentEntity, $this._transformCartesianToWGS84(pickedPosCollection));
            }

            // 执行额外的程序
            const _currentEntity = currentEntity;//当前绘制的实体
            const _currentPosArr = pickedPosCollection
            if (typeof pluginFunction === "function") {
                // 交给pluginFunction处理数据
                pluginFunction(_currentEntity, _currentPosArr);
            }
        }
        // bind events
        eM.onMouseClick(afterLeftClick);
        eM.onMouseMove(afterMouseMove);
        eM.onMouseRightClick(afterRightClick);


    }


    /**
     * 移除所有实体
     * @function
     */
    removeAll() {
        this._drawLayer.entities.removeAll();
    }
    /**
     * 移除监听事件
     * @function
     */
    removeEventHandler() {
        const _handler = this.currentHandler;
        if (_handler && !_handler.isDestroyed()) {
            _handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            _handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
            _handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        }
    }



}


// this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
// 为什么放弃创建一个总handler？
// -在 Cesium 中，ScreenSpaceEventHandler 允许你为不同的鼠标和触摸事件设置回调函数。
// --如果你在同一个 ScreenSpaceEventHandler 对象上为同一个事件类型（如 LEFT_CLICK、LEFT_DOUBLE_CLICK 等）设置多个回调函数，这些回调函数不会相互干扰，但后一个会覆盖前一个。
// --也就是说，同一个事件类型只能有一个回调函数，因此如果你需要对同一个事件类型执行多个操作，你需要在一个回调函数中处理所有逻辑。
// -或者! 仍然创建一个公共handler,但是调用之前先清空添加的事件



// test
// PointWithEvent(options, pluginFunction) {
//     this.drawWithEvent('point', options, pluginFunction)
// }
// LineWithEvent(options, pluginFunction) {
//     this.drawWithEvent('polyline', options, pluginFunction);
// }
// PolygonWithEvent(options, pluginFunction) {
//     this.drawWithEvent('polygon', options, pluginFunction)
// }
// RectangleWithEvent(options, pluginFunction) {
//     this.drawWithEvent('rectangle', options, pluginFunction)
// }
// CircleWithEvent(options, pluginFunction) {
//     this.drawWithEvent('ellipse', options, pluginFunction)
// }