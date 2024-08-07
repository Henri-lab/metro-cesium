import { isValidProvider, isValidTerrianProviderType, isValidImageryProviderType, isValidViewerProperty } from "../util/isValid";
import Manager from "./Manager";
import * as Cesium from "cesium";

// let Cesium = new Manager().Cesium;
// 必备 
window.CESIUM_BASE_URL = 'node_modules/cesium/Build/CesiumUnminified';


/**
 * 管理生成cesium viewer的配置文件 并可以初始化viewer
 */
export default class ConfigManager extends Manager {
    /**
     * 初始化 ConfigManager 类
     * @param {Object} cesiumGlobal - Cesium 全局对象
    */
    constructor() {
        super();
        this.init_data();
    }

    /**
     * 初始化数据
     */
    init_data() {
        this.viewer = null;
        this.pCMap = null;// provider config map
        this.defaultToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiMDk4NmM5OS03MmNlLTRiNWItOTUzNy1hYzhkMTUwYjgwNmQiLCJpZCI6MjE3MTc3LCJpYXQiOjE3MTcwNTUwMTh9.C3dvJjK0cBUhb87AI_EnpLPUwxD3ORI8sGcntlhCAmw';
    }

    /**
     * 初始化 Viewer
     * @param {Object} config - 配置对象
     * @param {string} config.containerId - 容器ID
     * @param {Object} config.baseConfig - Viewer 基础配置
     * @param {Object} config.providerConfig - 影像地形配置列表 
     * @param {{AccessToken,logo,depthTest,canvas}} config.extraConfig - 额外配置 
     * @returns {Cesium.Viewer} - 返回初始化后的 Viewer 对象
     */
    async initViewer({ containerId, baseConfig, providerConfig, extraConfig }) {
        // 配置token
        Cesium.Ion.defaultAccessToken = extraConfig['AccessToken'] || this.defaultToken;

        // 容器ID
        const mapID = containerId;

        // viewer配置
        let vConfig = /**@default*/{
            contextOptions: {
                webgl: {
                    alpha: false
                }
            },
            animation: false,
            timeline: false,
            fullscreenButton: false,
            geocoder: false,
            homeButton: false,
            selectionIndicator: false,
            shadow: true,
            sceneMode: Cesium.SceneMode.SCENE3D,
            infoBox: false,
            sceneModePicker: false,
            navigationHelpButton: false,
            projectionPicker: false,
            baseLayerPicker: false,
            shouldAnimate: true,
            navigation: false,
            showRenderLoopErrors: true
        };
        // 过滤无效配置
        for (const key in baseConfig) {
            if (baseConfig[key] === undefined || !isValidViewerProperty(baseConfig[key]))
                delete baseConfig[key];
        }
        vConfig = Object.assign(vConfig, baseConfig);



        this.pCMap = this.getProviderConfig(providerConfig);

        // 生成viewer

        // 地形数据配置(viewer)
        let tConfig = {};
        // 加载地形列表 -通过配置选项
        // 一般来说地形provider只有一个就够,多个可能是有切地形需求
        for (const type in this.pCMap.tMap) {
            // 地形provider配置(viewer.terrainProvider)
            const option = this.pCMap.tMap[type];
            tConfig.terrainProvider = this.createProvider({ type, option })
        }

        // 核心
        let viewer = new Cesium.Viewer(mapID, { ...vConfig, ...tConfig });


        // 加载影像图层列表 -通过 viewer.imageryLayers.addImageryProvider方法
        for (const type in this.pCMap.iMap) {
            const iConfig = this.pCMap.iMap[type];
            this.addImageryProvider(viewer, { type, option: iConfig });
        }

        // 设置viewer
        if (extraConfig['name']) {
            viewer.name = extraConfig['name'];
        }


        if (!extraConfig['logo']) {
            const cC = viewer.cesiumWidget.creditContainer;
            cC.style.display = 'none';
        }

        if (extraConfig['depthTest']) {
            viewer.scene.globe.depthTestAgainstTerrain = true;
        }

        if (extraConfig['canvas']) {
            // 访问 cesium-widget canvas 元素
            let vcanvas = viewer.scene.canvas;

            // 设置 cesium-widget canvas 的宽度和高度
            vcanvas.style.width = extraConfig['canvas'].width + 'px';
            vcanvas.style.height = extraConfig['canvas'].height + 'px';

            viewer.resize();
        }
        this.viewer = viewer;
        return viewer;
    }

    /**
     * 添加影像提供者
     * @param {Object} viewer - Viewer 实例
     * @param {string} cfg.type - 提供者类型
     * @param {Object} cfg.option - 提供者选项
     * @param {Object} cfg.customProvider - 自定义图源
     */

    addImageryProvider(viewer, { type, option }) {
        if (isValidImageryProviderType(type)) {
            const _cip = option.customProvider;
            // 没提供自定义 就创建对应的
            if (!_cip) {
                const _provider = this.createProvider({ type, option });
                viewer.imageryLayers.addImageryProvider(_provider);
            }
            // 提供了自定义 就使用自定义
            else if (_cip) {
                // console.log('loading custom imageryProvider')
                viewer.imageryLayers.addImageryProvider(_cip);
            }
        } else {
            console.warn(`${type} is not the valid imagery provider type`);
        }
    }

    /**
     * 获取 Cesium 提供者
     * @param {Object} options - 提供者配置选项
     * @returns {Object} - 返回配置对象
     */
    getProviderConfig(options) {

        let tMap = {};//存储地形类型和配置
        let iMap = {}; //存储影像类型和配置

        for (const _type/*provider细分类型*/ in options) {
            const configs = options[_type];

            if (!configs) continue;

            if (_type === 'terrainProvider')
                //地形provider类型属性  通常只需要一个地形provider 
                configs.forEach(config => isValidTerrianProviderType(config.type) && (tMap[config.type] = config.option));
            else if (_type === 'imageryProvider')
                //影像provider类型 
                configs.forEach(config => isValidImageryProviderType(config.type) && (iMap[config.type] = config.option));
        }
        return {
            tMap,
            iMap,
        };
    }

    /**
     * 创建 Cesium 提供者实例
     * @param {Object} config - 提供者配置
     * @param {string} config.type - 提供者类型
     * @param {Object} config.option - 提供者选项
     * @returns {Object} - 返回提供者实例
     */
    createProvider(config) {
        const ProviderClass = Cesium[config.type];
        return new ProviderClass(config.option);
    }
}




