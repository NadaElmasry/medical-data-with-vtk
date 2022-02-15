import '@kitware/vtk.js/favicon';

// Force DataAccessHelper to have access to various data source
import '@kitware/vtk.js/IO/Core/DataAccessHelper/HtmlDataAccessHelper';
import '@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper';
import '@kitware/vtk.js/IO/Core/DataAccessHelper/JSZipDataAccessHelper';

import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkImageMarchingCubes from '@kitware/vtk.js/Filters/General/ImageMarchingCubes';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';

import { vec3, quat, mat4 } from 'gl-matrix';

// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import '@kitware/vtk.js/Rendering/Profiles/Volume';
import '@kitware/vtk.js/Rendering/Profiles/Glyph';

import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkWidgetManager from '@kitware/vtk.js/Widgets/Core/WidgetManager';
import vtkHttpDataSetReader from '@kitware/vtk.js/IO/Core/HttpDataSetReader';
import vtkImageCroppingWidget from '@kitware/vtk.js/Widgets/Widgets3D/ImageCroppingWidget';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction';
import vtkVolume from '@kitware/vtk.js/Rendering/Core/Volume';
import vtkVolumeMapper from '@kitware/vtk.js//Rendering/Core/VolumeMapper';
import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';
import vtkColorMaps from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction/ColorMaps';
import vtkPiecewiseGaussianWidget from '@kitware/vtk.js/Interaction/Widgets/PiecewiseGaussianWidget';


function App() {

  //Head consts
  const headControlPanel = `
<table>
<tr>
  <td class='isoValue visible'>Iso value</td>
  <td>
    <input class='isoValue visible' type="range" min="0.0" max="1.0" step="0.05" value="0.5" />
  </td>
</tr>
</table>

`;
  const headUrlToLoad = `https://kitware.github.io/vtk-js/data/volume/headsq.vti`
  let firstIsoValue = 0
  let isoValue = 0

  const fullScreenRenderWindow = vtkFullScreenRenderWindow.newInstance({
    background: [0, 0, 0],
  });
  const renderWindow = fullScreenRenderWindow.getRenderWindow();
  const renderer = fullScreenRenderWindow.getRenderer();
  const headReader = vtkHttpDataSetReader.newInstance({ fetchGzip: true });
 
  
  const headActor = vtkActor.newInstance();
  const headMapper = vtkMapper.newInstance();
  const marchingCube = vtkImageMarchingCubes.newInstance({
    contourValue: 0.0,
    computeNormals: true,
    mergePoints: true,
  });
  
  headActor.setMapper(headMapper);
  marchingCube.setInputConnection(headReader.getOutputPort());
  headMapper.setInputConnection(marchingCube.getOutputPort());
  fullScreenRenderWindow.addController(headControlPanel);

//----------------------------------------------------------------

//Chest consts

  
const containerStyle =  { height: '100%' };
const chestUrlToLoad = 'https://kitware.github.io/vtk-js/data/volume/LIDC2.vti'; 

const apiRenderWindow = fullScreenRenderWindow.getApiSpecificRenderWindow();
const chestReader = vtkHttpDataSetReader.newInstance({ fetchGzip: true });

renderWindow.getInteractor().setDesiredUpdateRate(15.0);

// Create Widget container
const widgetContainer = document.createElement('div');
widgetContainer.style.position = 'fixed';
widgetContainer.style.top = '50px';
widgetContainer.style.left = '5px';
widgetContainer.style.background = 'rgba(255, 255, 255, 0.3)';
widgetContainer.style.visibility = 'hidden';
document.querySelector('body').appendChild(widgetContainer);


// Create Label for preset
const labelContainer = document.createElement('div');
labelContainer.style.position = 'absolute';
labelContainer.style.top = '5px';
labelContainer.style.left = '5px';
labelContainer.style.width = '100%';
labelContainer.style.color = 'yellow';
labelContainer.style.textAlign = 'center';
labelContainer.style.userSelect = 'none';
labelContainer.style.cursor = 'pointer';
labelContainer.style.visibility = 'hidden';
document.querySelector('body').appendChild(labelContainer);

let presetIndex = 1;
const globalDataRange = [0, 255];
const lookupTable = vtkColorTransferFunction.newInstance();
let intervalID = null;

const widget = vtkPiecewiseGaussianWidget.newInstance({
  numberOfBins: 256,
  size: [400, 150],
});
widget.updateStyle({
  backgroundColor: 'rgba(255, 255, 255, 0.6)',
  histogramColor: 'rgba(100, 100, 100, 0.5)',
  strokeColor: 'rgb(0, 0, 0)',
  activeColor: 'rgb(255, 255, 255)',
  handleColor: 'rgb(50, 150, 50)',
  buttonDisableFillColor: 'rgba(255, 255, 255, 0.5)',
  buttonDisableStrokeColor: 'rgba(0, 0, 0, 0.5)',
  buttonStrokeColor: 'rgba(0, 0, 0, 1)',
  buttonFillColor: 'rgba(255, 255, 255, 1)',
  strokeWidth: 2,
  activeStrokeWidth: 3,
  buttonStrokeWidth: 1.5,
  handleWidth: 3,
  iconSize: 20, // Can be 0 if you want to remove buttons (dblClick for (+) / rightClick for (-))
  padding: 10,
});

fullScreenRenderWindow.setResizeCallback(({ width, height }) => {
  widget.setSize(Math.min(400, width - 10), 200);
});

const piecewiseFunction = vtkPiecewiseFunction.newInstance();

const chestActor = vtkVolume.newInstance();
const chestMapper = vtkVolumeMapper.newInstance({ sampleDistance: 1.1 });
const widgetManager = vtkWidgetManager.newInstance();
widgetManager.setRenderer(renderer);

const cropwidget = vtkImageCroppingWidget.newInstance();

const overlaySize = 15;
const overlayBorder = 2;
const overlay = document.createElement('div');
overlay.style.position = 'absolute';
overlay.style.width = `${overlaySize}px`;
overlay.style.height = `${overlaySize}px`;
overlay.style.border = `solid ${overlayBorder}px red`;
overlay.style.borderRadius = '50%';
overlay.style.left = '-100px';
overlay.style.pointerEvents = 'none';
overlay.style.visibility = 'hidden';
document.querySelector('body').appendChild(overlay);

//---------------------------------------

//helper functions
  
  function updateIsoValue(e) {
    isoValue = Number(e.target.value);
    marchingCube.setContourValue(isoValue);
    renderWindow.render();
  }

  function ChestRender(){
    console.log('chestrendercalled');
    headActor.setVisibility(false);
    chestActor.setVisibility(true);
    fullScreenRenderWindow.setControllerVisibility(false);
    renderer.getActiveCamera().elevation(70);
    renderer.resetCamera();
    widgetContainer.style.visibility = 'visible';
    overlay.style.visibility = 'visible';
    labelContainer.style.visibility = 'visible';
    widgetRegistration(1);
    renderWindow.render();
  }

  function HeadRender(){
    chestActor.setVisibility(false);
    headActor.setVisibility(true);
    renderer.getActiveCamera().set({ position: [1, 1, 0], viewUp: [0, 0, -1] });
    fullScreenRenderWindow.setControllerVisibility(true);
    renderer.resetCamera();
    widgetContainer.style.visibility = 'hidden';
    overlay.style.visibility = 'hidden';
    labelContainer.style.visibility = 'hidden';
    widgetRegistration(0);
    renderWindow.render();
  }

  function changePreset(delta = 1) {
    presetIndex =
        (presetIndex + delta + vtkColorMaps.rgbPresetNames.length) %
        vtkColorMaps.rgbPresetNames.length;
    lookupTable.applyColorMap(
        vtkColorMaps.getPresetByName(vtkColorMaps.rgbPresetNames[presetIndex])
    );
    lookupTable.setMappingRange(...globalDataRange);
    lookupTable.updateRange();
    labelContainer.innerHTML = vtkColorMaps.rgbPresetNames[presetIndex];
}



function stopInterval() {
    if (intervalID !== null) {
        clearInterval(intervalID);
        intervalID = null;
    }
}

labelContainer.addEventListener('click', (event) => {
    if (event.pageX < 200) {
        stopInterval();
        changePreset(-1);
    } else {
        stopInterval();
        changePreset(1);
    }
});


function widgetRegistration(flag) {
  if(flag){
    const viewWidget = widgetManager.addWidget(cropwidget);
    
        viewWidget.setDisplayCallback((coords) => {
            overlay.style.left = '-100px';
            if (coords) {
                const [w, h] = apiRenderWindow.getSize();
                overlay.style.left = `${Math.round(
          (coords[0][0] / w) * window.innerWidth -
            overlaySize * 0.5 -
            overlayBorder
        )}px`;
                overlay.style.top = `${Math.round(
          ((h - coords[0][1]) / h) * window.innerHeight -
            overlaySize * 0.5 -
            overlayBorder
        )}px`;
            }
        });
      


        widgetManager.enablePicking();
    }
    else{
      widgetManager.removeWidget(cropwidget);

    }

    renderer.resetCameraClippingRange();
    renderWindow.render();
}

function getCroppingPlanes(imageData, ijkPlanes) {
    const rotation = quat.create();
    mat4.getRotation(rotation, imageData.getIndexToWorld());

    const rotateVec = (vec) => {
        const out = [0, 0, 0];
        vec3.transformQuat(out, vec, rotation);
        return out;
    };

    const [iMin, iMax, jMin, jMax, kMin, kMax] = ijkPlanes;
    const origin = imageData.indexToWorld([iMin, jMin, kMin]);
    // opposite corner from origin
    const corner = imageData.indexToWorld([iMax, jMax, kMax]);
    return [
        // X min/max
        vtkPlane.newInstance({ normal: rotateVec([1, 0, 0]), origin }),
        vtkPlane.newInstance({ normal: rotateVec([-1, 0, 0]), origin: corner }),
        // Y min/max
        vtkPlane.newInstance({ normal: rotateVec([0, 1, 0]), origin }),
        vtkPlane.newInstance({ normal: rotateVec([0, -1, 0]), origin: corner }),
        // X min/max
        vtkPlane.newInstance({ normal: rotateVec([0, 0, 1]), origin }),
        vtkPlane.newInstance({ normal: rotateVec([0, 0, -1]), origin: corner }),
    ];
}



const buttons = document.querySelectorAll('button');
for (let i = 0; i < buttons.length; i++) {
  buttons[i].addEventListener('click', widgetRegistration);
}

widget.addGaussian(0.425, 0.5, 0.2, 0.3, 0.2);
widget.addGaussian(0.75, 1, 0.3, 0, 0);

widget.setContainer(widgetContainer);
widget.bindMouseListeners();

widget.onAnimation((start) => {
    if (start) {
        renderWindow.getInteractor().requestAnimation(widget);
    } else {
        renderWindow.getInteractor().cancelAnimation(widget);
    }
});

widget.onOpacityChange(() => {
    widget.applyOpacity(piecewiseFunction);
    if (!renderWindow.getInteractor().isAnimating()) {
        renderWindow.render();
    }
});
//------------------------------------------------------------------------------------
  
  headReader
    .setUrl(headUrlToLoad, { loadData: true })
    .then(() => {
     const data = headReader.getOutputData();
     const dataRange = data.getPointData().getScalars().getRange();
      firstIsoValue = (dataRange[0] + dataRange[1]) / 3;
    marchingCube.setContourValue(firstIsoValue);
  

      renderer.addActor(headActor);
      renderer.getActiveCamera().set({ position: [1, 1, 0], viewUp: [0, 0, -1] });
      renderer.resetCamera();
      renderWindow.render();
      const el = document.querySelectorAll('.isoValue');
      for (let i = 0; i < el.length; i++) {
        el[i].setAttribute('min', dataRange[0]);
        el[i].setAttribute('max', dataRange[1]);
        el[i].setAttribute('value', firstIsoValue);
        el[i].addEventListener('input', updateIsoValue);}
    });
  
    chestReader.setUrl(chestUrlToLoad).then(() => {
      chestReader.loadData().then(() => {
          const imageData = chestReader.getOutputData();
          const dataArray = imageData.getPointData().getScalars();
          const dataRange = dataArray.getRange();
          globalDataRange[0] = dataRange[0];
          globalDataRange[1] = dataRange[1];
 
          changePreset();


              intervalID = setInterval(changePreset, 5000);
          
  
          widget.setDataArray(dataArray.getData());
          widget.applyOpacity(piecewiseFunction);
  
          widget.setColorTransferFunction(lookupTable);
          lookupTable.onModified(() => {
              widget.render();
              renderWindow.render();
          });
                  // // update crop widget
                  cropwidget.copyImageDataDescription(imageData);
                  const cropState = cropwidget.getWidgetState().getCroppingPlanes();
                  cropState.onModified(() => {
                      const planes = getCroppingPlanes(imageData, cropState.getPlanes());
                      chestMapper.removeAllClippingPlanes();
                      planes.forEach((plane) => {
                        chestMapper.addClippingPlane(plane);
                      });
                      chestMapper.modified();
                  });

          renderer.addVolume(chestActor);
          chestActor.setVisibility(false);
          // renderer.resetCamera();
          renderer.resetCameraClippingRange();
          renderWindow.render();
      });
  });
  
  chestActor.setMapper(chestMapper);
  chestMapper.setInputConnection(chestReader.getOutputPort());
  
  chestActor.getProperty().setRGBTransferFunction(0, lookupTable);
  chestActor.getProperty().setScalarOpacity(0, piecewiseFunction);
  chestActor.getProperty().setInterpolationTypeToFastLinear();



  return (
    <div  style={{
        zIndex: "2",
          position: 'relative',
          top: '300px',
          left: '20px',
          width: '160px',
          height: '40px',
          background: 'white',
          padding: '12px',
          borderRadius: '10px',
          backgroundColor: 'white',
        }}>
          
      <button id='click' style={{margin:'5px', width: '70px',height: '30px',}} onClick = {ChestRender}>Chest</button>
      <button id='click' style={{margin:'5px', width: '70px',height: '30px',}} onClick = {HeadRender}>Head</button>
      
</div>

  );
}

export default App;
