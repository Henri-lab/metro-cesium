/** 
 * @description
 * 为cesium项目初始化viewer 并加载需要的数据
*/

import * as Cesium from 'cesium';
import {
  ConfigManager,
  SceneManager,
  CameraManager
} from '../cesium_dev_helper/czmHelper/Manager';
import { TencentImageryProvider } from '../cesium_dev_helper/czmHelper/Map/mapPlugin';

import json from '../cesium_dev_helper/traffic/assets/model/tileset.json'

// 创建地图容器
const cV = document.createElement('div');
cV.id = 'czm-viewer' + new Date().now;
document.body.appendChild(cV)




//腾讯底图
const txOpt = {
  style: 4, //style: img、1：经典
  crs: 'WGS84',
};
const tCip = new TencentImageryProvider(txOpt);

// 配置viewer
const cfgM = new ConfigManager();
const vcfg = {
  containerId: `${cV.id}`,
  viewerConfig: {
    navigationHelpButton: true,
    navigationInstructionsInitiallyVisible: true,
    // skyAtmosphere: new Cesium.SkyAtmosphere(),
  },
  providerConfig: {
    terrainProvider: [],
    imageryProvider: [
      {
        type: 'UrlTemplateImageryProvider',
        option: {
          customProvider: tCip,
        },
      },
    ],
  },
  extraConfig: {
    AccessToken: import.meta.env.VITE_CESIUM_KEY,
    logo: false,
    depthTest: true,
    canvas: {
      width: 1000,
      height: 600,
    },
  },
};

// wuhan
const wuhan = {
  longitude: 113.95,
  latitude: 30.19,
  height: 34000,
}
const flyOpt = {
  orientation: {
    heading: Cesium.Math.toRadians(35.0),
    pitch: Cesium.Math.toRadians(-90.0),
    roll: 0.0,
  },
  duration: 2,
}

// 3dtiles
function suc(model) {
  console.log('load 3d model success', model);
}
function err(e) {
  console.log('load 3d model error', e);
}

function pgs(progress) {
  console.log('load 3d model progress', progress);
}
const modelOpt = {
  url: "src/cesium_dev_helper/traffic/assets/model/tileset.json",
  onSuccess: suc,
  onError: err,
  onProgress: pgs,
}

async function loadCzmViewerAt(app) {
  let _app = app;
  const czmViewer = await cfgM.initViewer(vcfg);
  console.log('cesium viewer init completed');

  _app.config.globalProperties.$czmViewer = czmViewer;
  console.log('cesium viewer globalProperties loaded');

  const sM = new SceneManager(czmViewer);
  sM.initScene();
  console.log('cesium scene init completed');

  const cM = new CameraManager(czmViewer);
  cM.flyTo(wuhan, flyOpt);
  console.log('cesium camera setting completed');

  sM.add3DModel(modelOpt, '3dtiles', (tiles) => {
    const _loadedModel = tiles[0];
    console.log(_loadedModel, 'loadedModle');
    // sM.handleDefaultModelEffect(_loadedModel)
    _app.config.globalProperties.$czmLoaded3dTile = _loadedModel;
    console.log('3d model init completed');
  })



  // test
  // try {
  //   const res = new Cesium.Cesium3DTileset({ url: "src/cesium_dev_helper/traffic/assets/model/tileset.json" })
  //   console.log(res, 'model')
  //   czmViewer.scene.primitives.add(res)
  // } catch (e) {
  //   console.log('cesium 3dtiles load error1', e)
  // }

  // try {
  //   const tileset = await Cesium.Cesium3DTileset.fromUrl("src/cesium_dev_helper/traffic/assets/model/tileset.json");
  //   czmViewer.scene.primitives.add(tileset);
  // } catch (e) {
  //   console.log('cesium 3dtiles load error2', e)
  // }


}
let cvp = null;
export default cvp = {
  async install(app) {
    await loadCzmViewerAt(app);
  }
}
