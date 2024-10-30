import { Atp45Result } from './../api/models/atp-45-result';
import { GeoJsonSliceResponse } from './../api/models/geo-json-slice-response';
import { Injectable } from '@angular/core';
import { MapPlot, PlotType } from '../models/map-plot';
import { MapService } from './map.service';
import { Feature, FeatureCollection } from 'geojson';
import { ColorbarData } from '../api/models';
import { circle, circleMarker, FeatureGroup, geoJSON, LayerGroup } from 'leaflet';
import parseGeoraster from 'georaster';
import GeoRasterLayer from 'georaster-layer-for-leaflet';
import chroma from 'chroma-js';
import { actionMatcher } from '@ngxs/store';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { tick } from '@angular/core/testing';


const POINT_MARKER_OPTIONS = {
  radius: 2,
  fillColor: "black",
  color: "black",
  weight: 1,
  opacity: 1,
  fillOpacity: 1
};

const REL_LOC_MARKER_OPTIONS = {
  radius: 5,
  fillColor: "red",
  color: "red",
  weight: 4,
  opacity: 1,
  fillOpacity: 1
};

function getColor(value: number, colorbar: ColorbarData) {
  let ticks = colorbar.ticks as number[];
  let colors = colorbar!.colors as string[];
  let n = ticks.length;
  if (value <= ticks[0]) {
    return colors[0];
  }
  for (let i = 1; i < n; i++) {
    if (value <= ticks[i]) {
      return colors[i - 1];
    }
  }
  return colors[n - 2];
}

@Injectable({
  providedIn: 'root'
})
export class MapPlotsService {


  constructor(
    private mapService: MapService,
  ) {
    this.selectedLayer$.subscribe(layer => {
      this.currentSelectedLayer = layer;
    })
   }

  //to handle the unit changing depending on selected layer
  private selectedLayerSubject = new BehaviorSubject<string>('');
  selectedLayer$ = this.selectedLayerSubject.asObservable();
  private currentSelectedLayer: string = '';
  setSelectedLayer(layer: string) {
    console.log("in map plot, Setting layerName:", layer)
    this.selectedLayerSubject.next(layer);
  }

  //to handle the active plots changing 
  private activePlotSubject = new BehaviorSubject<MapPlot | null>(null);
  activePlot$ = this.activePlotSubject.asObservable();

  setActivePlot(plot: MapPlot) {
    this.activePlotSubject.next(plot);
    console.log("Active plot set to: ", plot);
  }


  fillPlotGeoJSON(plotData: Atp45Result | GeoJsonSliceResponse, type: PlotType) {
    let newPlot = new MapPlot(type);

    newPlot.metadata = plotData.metadata
    newPlot.geojson = plotData.collection as FeatureCollection;
    return newPlot;
  }

  async fillPlotTiff(plotData: Blob, type: PlotType) {
    const arrayBuffer = await plotData.arrayBuffer()
    const geoRaster = await parseGeoraster(arrayBuffer);
    let newPlot = new MapPlot(type);
    console.log(geoRaster);
    newPlot.data = geoRaster;
    newPlot.metadata = this._colorbarFromGeoRaster(geoRaster)

    if (this.currentSelectedLayer) {
      newPlot.setLegendLayer(this.currentSelectedLayer);
    }
    console.log("inside fillPlotTiff " + newPlot.legendLayer)
    return newPlot
  }

  addTiff(geoRaster: any) {
    console.log(geoRaster)
    // inspired from https://github.com/GeoTIFF/georaster-layer-for-leaflet-example/blob/master/examples/color-scale.html

    const unit: string = "kg";
    const output: string = "concentration";
    let min: number;
    let max: number;
    let activity: number;
    const length = 10;
    let ticks: number[] = [];
    let ticks_depo: number[] = [];
    let ticks_mr: number[] = [];
    let scale: chroma.Scale;

    activity = 1;
    if (unit == "bq"){
      activity = 3.215; // kBq in 1 ng of caesium-137
    }
    min = 0.001 * activity;
    max = geoRaster.maxs[0] * activity;
    let step = Math.pow(max / min, 1 / (length - 1));
    for (let i = 0; i < length; i++) {
      let tick = min * Math.pow(step, i)
      ticks.push(tick);
    }
    scale = this._colorScale().domain(ticks.slice().reverse());

    const imageryLayer = new GeoRasterLayer({
      georaster: geoRaster,
      pixelValuesToColorFn: pixelValues => {
        let pixelValue = pixelValues[0] * activity; // there's just one band in this raster

        if (pixelValue <= min) return "";
        let colorIndex = ticks.length - 1;
        for (let i = 1; i < ticks.length; i++) {
          if (ticks[i-1] < pixelValue && pixelValue <= ticks[i]) {
            colorIndex = i;
            break;
          }
        }
        let color = scale(ticks[colorIndex]).hex();
        return color;
      },
      resolution: 256,
      opacity: 0.8
    });

    return imageryLayer as typeof GeoRasterLayer;
  }

  _colorScale() {
    return chroma.scale("Spectral");
  }
  // _colorScale_depo() {
  //   return chroma.scale(['800000', 'F0E68C']);
  // }

  _colorbarFromGeoRaster(geoRaster: any, length = 10): ColorbarData {
    const unit: string = "kg";
    const output: string = "concentration";
    let min: number;
    let max: number;
    let activity: number;
    let ticks: number[] = [];
    let ticks_depo: number[] = [];
    let ticks_mr: number[] = [];
    let colors: string[] = [];
    let scale: chroma.Scale;

    activity = 1;
    if (unit == "bq"){
      activity = 3.215; // kBq in 1 ng of caesium-137
      // ticks_depo = [0, 2, 4, 10, 20, 40, 100, 185, 555, 1480]; // ticks used in similar papers for deposition in kBq/m^2
      // ticks_mr = [0, 1, 2, 5, 10, 15, 25, 40, 100, 300]; // ticks used in similar papers for mixing ratio in kBq/m^3
      // ticks = ticks_depo;
    }
    min = 0.001 * activity;
    max = geoRaster.maxs[0] * activity;
    let step = Math.pow(max / min, 1 / (length - 1));
    for (let i = 0; i < length; i++) {
      let tickValue = min * Math.pow(step, i);
      let precision;

      //higher numbers = less precision (digit after commas)
      if (tickValue < 1) {
        precision = 3;  
      } else if (tickValue < 10) {
        precision = 2;
      } else if (tickValue < 100) {
        precision = 1;
      } else {
        precision = 0;  
      }

      //round numbers but keep them as numbers
      let tick = Math.round(tickValue * Math.pow(10, precision)) / Math.pow(10, precision);

      ticks.push(tick);
    }
    scale = this._colorScale().domain(ticks.slice().reverse());

    for (let i = 1; i < length; i++){
      colors.push(scale(ticks[i]).hex())
    }
    //colors.shift()
    return {
      colors,
      ticks
    };
  }

  // // For Plots of Radiological releases in Becquerels with fixed scale 
  //
  // addTiff(geoRaster: any) {
  //   console.log(geoRaster)
  //   // inspired from https://github.com/GeoTIFF/georaster-layer-for-leaflet-example/blob/master/examples/color-scale.html

  //   const unit: string = "bq";
  //   const output: string = "concentration";
  //   let min: number;
  //   let max: number;
  //   let activity: number;
  //   const length = 10;
  //   let ticks: number[] = [];
  //   let ticks_depo: number[] = [];
  //   let ticks_mr: number[] = [];
  //   let scale: chroma.Scale;

  //   //activity = 3.215; // kBq in 1 ng of caesium-137
  //   activity = 4630 // kBq in 1 ng of iodine-131
  //   ticks_depo = [0, 2, 4, 10, 20, 40, 100, 185, 555, 1480]; // ticks used in similar papers for deposition in kBq/m^2
  //   // ticks_mr = [0, 1, 2, 5, 10, 15, 25, 40, 100, 300]; // ticks used in similar papers for mixing ratio in kBq/m^3
  //   ticks = ticks_depo;
  //   scale = this._colorScale().domain(ticks.slice().reverse());

  //   const imageryLayer = new GeoRasterLayer({
  //     georaster: geoRaster,
  //     pixelValuesToColorFn: pixelValues => {
  //       let pixelValue = pixelValues[0] * activity; // there's just one band in this raster

  //       if (pixelValue === 0) return "";
  //       let colorIndex = ticks.length - 1;
  //       for (let i = 1; i < ticks.length; i++) {
  //         if (ticks[i-1] < pixelValue && pixelValue <= ticks[i]) {
  //           colorIndex = i-1;
  //           break;
  //         }
  //       }
  //       let color = scale(ticks[colorIndex]).hex();
  //       return color;
  //     },
  //     resolution: 256,
  //     opacity: 0.8
  //   });

  //   return imageryLayer as typeof GeoRasterLayer;
  // }

  // _colorScale() {
  //   return chroma.scale("Spectral");
  // }
  // // _colorScale_depo() {
  // //   return chroma.scale(['800000', 'F0E68C']);
  // // }

  // _colorbarFromGeoRaster(geoRaster: any, length = 10): ColorbarData {
  //   const unit: string = "bq";
  //   const output: string = "concentration";
  //   let min: number;
  //   let max: number;
  //   let activity: number;
  //   let ticks: number[] = [];
  //   let ticks_depo: number[] = [];
  //   let ticks_mr: number[] = [];
  //   let colors: string[] = [];
  //   let scale: chroma.Scale;

  //   //activity = 3.215; // kBq in 1 ng of caesium-137
  //   activity = 4630 // kBq in 1 ng of iodine-131
  //   ticks_depo = [0, 2, 4, 10, 20, 40, 100, 185, 555, 1480]; // ticks used in similar papers for deposition in kBq/m^2
  //   // ticks_mr = [0, 1, 2, 5, 10, 15, 25, 40, 100, 300]; // ticks used in similar papers for mixing ratio in kBq/m^3
  //   ticks = ticks_depo;
  //   scale = this._colorScale().domain(ticks.slice().reverse());
    
  //   for (let i = 0; i < length; i++){
  //     colors.push(scale(ticks[i]).hex())
  //   }
  //   //colors.shift()
  //   return {
  //     colors,
  //     ticks
  //   };
  // }

  setColors(layers: LayerGroup, colorbar: ColorbarData) {
    layers.eachLayer((layer: any) => {
      let val = layer.feature.properties.val;
      if (val !== undefined) {
        layer.setStyle({
          color: getColor(val, colorbar),
        });
      }
    });
  }

  flexpartPlotToLayer(collection: FeatureCollection) {
    // let options: L.GeoJSONOptions = {
    //     pointToLayer: function (feature: any, latlng: L.LatLng) {
    //         if (feature.properties.type === "releasePoint") {
    //             return circleMarker(latlng, REL_LOC_MARKER_OPTIONS);
    //         }
    //         return circleMarker(latlng, POINT_MARKER_OPTIONS);
    //     },
    //     style: (feature: any) => {
    //         let options: L.PathOptions = {
    //             stroke: false,
    //             fillOpacity: 0.4,
    //         }
    //         options = feature.properties ? {...options, color: feature.properties.color } : options
    //         return options;
    //     },
    // };

    let layers = geoJSON(undefined, {
      pmIgnore: true
    });
    let featureGroup = new FeatureGroup()
    layers.addData(collection as FeatureCollection);
    featureGroup.addLayer(layers)
    return featureGroup;
  }

  atp45PlotToLayer(collection: FeatureCollection) {
    let options: L.GeoJSONOptions = {
      pointToLayer: function (feature: any, latlng: L.LatLng) {
        if (feature.properties.type === "releasePoint") {
          return circleMarker(latlng, REL_LOC_MARKER_OPTIONS);
        }
        return circleMarker(latlng, POINT_MARKER_OPTIONS);
      },
      style: (feature: any) => {
        let options: L.PathOptions = {
          // stroke: false,
          fillOpacity: 0.4,
        }
        options = feature.properties.type == "release" ? { ...options, color: "red" } : options
        return options;
      },
    };
    let geojson = geoJSON(undefined, {
      pmIgnore: true,
      ...options
    });
    let featureGroup = new FeatureGroup()
    geojson.addData(collection as FeatureCollection);
    featureGroup.addLayer(geojson)
    // return layers as LayerGroup
    return featureGroup
  }


  createMapPlotGeoJSON({ type, plotData }: any) {
    let mapPlot = this.fillPlotGeoJSON(plotData, type)
    return mapPlot;
  }

  createMapPlotTiff({ type, plotData }: any) {
    let mapPlot = this.fillPlotTiff(plotData, type)
    return mapPlot;
  }
}
