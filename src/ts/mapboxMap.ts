module powerbi.extensibility.visual {
    "use strict";
    export function logExceptions(): MethodDecorator {
        return function (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<Function>)
        : TypedPropertyDescriptor<Function> {
            
            return {
                value: function () {
                    try {
                        return descriptor.value.apply(this, arguments);
                    } catch (e) {
                        console.error(e);
                        throw e;
                    }
                }
            }
        }
    }

    export class MapboxMap implements IVisual {
        private map: mapboxgl.Map;
        private mapOptions: mapboxgl.MapboxOptions;
        private mapDiv: HTMLDivElement;
        private mapOptionsDiv: HTMLElement;
        private mapLegend: HTMLElement;
        private dataView: DataView;
        private popup: mapboxgl.Popup;
        private host: IVisualHost;
        private categoryName: string = "";
        private measureName: string = "";
        private firstRun: boolean = true;
        private MAPBOX_ACCESS_TOKEN: string = "pk.eyJ1IjoicnNiYXVtYW5uIiwiYSI6ImNqNmFibmgyYjExeDgycXJ5emltZmR4dWgifQ.a1eP4yuu6UsxhZ1wEWDQgA"

        constructor(options: VisualConstructorOptions) {
            this.host = options.host;
            //Map initialization    
            this.mapDiv = document.createElement('div');
            this.mapDiv.className = 'map';
            this.mapDiv.style.position = "absolute";
            this.mapDiv.style.top = "0";
            this.mapDiv.style.bottom ="0";
            this.mapDiv.style.left ="0";
            this.mapDiv.style.width = "100%";
            this.mapDiv.style.overflow = 'visible';
            options.element.appendChild(this.mapDiv);
            
            this.mapLegend = document.createElement('legend');
            this.mapLegend.className = 'legend';
            this.mapLegend.id = 'legend';
            this.mapDiv.appendChild(this.mapLegend);

            /* TBD - Map options element to select color, map style, and viz type
            this.mapOptionsDiv = document.createElement('div');
            this.mapOptionsDiv.className = 'options mapboxgl-ctrl-top-left';
            this.mapOptionsDiv.id = 'mapOptions';
            this.mapOptionsDiv.innerHTML = 'Options'
            this.mapDiv.appendChild(this.mapOptionsDiv);
            */

            this.mapOptions = {
                container: this.mapDiv,
                style: 'mapbox://styles/mapbox/dark-v9?optimize=true',
                center: [-74.50, 40],
                zoom: 0
            }

            mapboxgl.accessToken = this.MAPBOX_ACCESS_TOKEN;

            this.popup = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false
            });

            //If the map container doesnt exist yet, create it
            if (this.map === undefined ) {
                this.map = new mapboxgl.Map(this.mapOptions);
                this.map.addControl(new mapboxgl.NavigationControl());
            }
        }

        @logExceptions()
        public static converter(dataView: DataView, host: IVisualHost) {

            const {columns, rows} = dataView.table;
            var numerical_domain : any = [];
            var categorical_domain : any = [];

            function inArray(array, comparer) { 
			    for(var i=0; i < array.length; i++) { 
			        if(comparer(array[i])) return true; 
			    }
			    return false; 
			}; 

			function pushIfNotExist(array, element, comparer) { 
			    if (!inArray(array, comparer)) {
			        array.push(element);
			    }
			}; 

			function positionInArray(array, element) { 
			    for (var i=0; i < array.length; i++) { 
			        if (element === array[i]) {
			        	var returnValue : number = i;
			        	return returnValue;
			        }
			    }
			}; 

			function calcCircleColorLegend(colorStops, valueStops, title) {
			    //Calculate a legend element on a Mapbox GL Style Spec property function stops array
			    var legend = document.getElementById('legend');
			    legend.innerHTML = ''

			    var mytitle = document.createElement('div');
			    mytitle.textContent = title;
			    mytitle.id = 'legend-title';
			    mytitle.className = 'legend-title';

			    legend.appendChild(mytitle);

			    for (var p = 0; p < colorStops.length; p++) {

			            //create the legend if it doesn't yet exist
			            var item = document.createElement('div');
			            var key = document.createElement('span');
			            key.className = 'legend-key';
			            var value = document.createElement('span');
			            key.id = 'legend-points-id-' + p;
			            key.style.backgroundColor = colorStops[p];
			            value.id = 'legend-points-value-' + p;
			            item.appendChild(key);
			            item.appendChild(value);
			            legend.appendChild(item);
			            
			            let data = document.getElementById('legend-points-value-' + p)
			            data.textContent = valueStops[p];
			    }
			}

            const datas = rows.map(function (row, idx) {
                let data = row.reduce(function (d : any, v, i) {
                    const role = Object.keys(columns[i].roles)[0]
                    d[role] = v;
                    if (role == 'category') {
                        if (typeof v === "number") {
                            numerical_domain.push(v)
                        }
                        else if ( (typeof v === "string") || (typeof v === "boolean") ) {
                        	pushIfNotExist(categorical_domain, v, function(e) {
                        		return e === v
                        	})
                        }
                    }
                    return d;
                }, {});
                return data;
            });

            var features = [];

            if (numerical_domain.length > 0) {

            	datas.map(function (d) {
            		if ( (d.latitude >= -90) && (d.latitude <= 90) && (d.longitude >= -180) && (d.longitude <= 180) ) {
		                let feat: GeoJSON.Feature<any> = {
		                    "type": "Feature",
		                    "geometry": {
		                        "type": "Point",
		                        "coordinates": [d.longitude, d.latitude]
		                    },
		                    "properties": {
		                        "tooltip": (d.category) ? d.category : null
		                    }
		                }
		                features.push(feat)
	            }
            	});

            	//calcCircleColorLegend(scale.colors(8), limits, "Measure");
	        }
	        else if (categorical_domain.length > 0) {
	        	var scale = chroma.scale('Set2').domain([0, categorical_domain.length]);

        	    datas.map(function (d) {
        	    	if ( (d.latitude >= -90) && (d.latitude <= 90) && (d.longitude >= -180) && (d.longitude <= 180) ) {

	        	    	let position : any = positionInArray(categorical_domain, d.category);
		                let feat: GeoJSON.Feature<any> = {
		                    "type": "Feature",
		                    "geometry": {
		                        "type": "Point",
		                        "coordinates": [d.longitude, d.latitude]
		                    },
		                    "properties": {
		                        "tooltip": (d.category) ? d.category : null
		                    }
		                }
		                features.push(feat)
	                }
            	});
        	    let length = categorical_domain.length
        	    let legnend_length = length < 8 ? length : 8
            	//calcCircleColorLegend(scale.colors(legnend_length), categorical_domain.slice(0,legnend_length), "Measure");
	        }

            return features;
        }

        public static debounce(func, wait, immediate) {
            var timeout;
            var returnFunction : any = function() {
                var context = this, args = arguments;
                var later = function() {
                    timeout = null;
                    if (!immediate) func.apply(context, args);
                };
                var callNow = immediate && !timeout;
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
                if (callNow) func.apply(context, args);
            };

            return returnFunction
        };

        public static create_fc(features : Array<GeoJSON.Feature<any>>) {
            var empty_fc : any = {"type": "FeatureCollection", "features": []};
            return empty_fc.features.push(features);
        }

        @logExceptions()
        public update(options: VisualUpdateOptions) {
            var _this = this
            //Only run this step if there are lat/long values to parse
            if (options.dataViews[0].metadata.columns.length < 2) { 
                _this.firstRun = false;
                return 
            };

            this.dataView = options.dataViews[0];
            var features = MapboxMap.converter(this.dataView, this.host);

            function onUpdate() {
                if (_this.map.getSource('data1')) {
                    let source1 : any = _this.map.getSource('data1');
                    source1.setData( turf.featureCollection(features));
                }
                else {
                    _this.map.addSource('data1', {
                        type: "geojson", 
                        data: turf.featureCollection(features),
                        buffer: 10
                    });

                    _this.map.addLayer({
                        'id': '3d-buildings',
                        'source': 'composite',
                        'source-layer': 'building',
                        'filter': ['==', 'extrude', 'true'],
                        'type': 'fill-extrusion',
                        'minzoom': 15,
                        'paint': {
                            'fill-extrusion-color': '#aaa',
                            'fill-extrusion-height': {
                                'type': 'identity',
                                'property': 'height'
                            },
                            'fill-extrusion-base': {
                                'type': 'identity',
                                'property': 'min_height'
                            },
                            'fill-extrusion-opacity': .5
                        }
                    }, 'waterway-label');

                    _this.map.addLayer({
                        id: "heatmap-1",
                        source: 'data1',
                        type: "heatmap",
                        paint: {
                            "heatmap-radius": {
                                "stops": [
                                    [0,1], 
                                    [10,20], 
                                    [18,50]
                                ]
                            },
                            "heatmap-intensity": {
                                "stops": [
                                    [8, 0.01],
                                    [12, 0.5],
                                    [18,1]
                                ]
                            },
                            "heatmap-weight": {
                                "property": "tooltip",
                                "type": "exponential",
                                "default": 0,
                                "stops": [
                                    [1, 0.8],
                                    [3, 1]
                                ]
                            }
                        }
                    }, 'waterway-label');
            }
        }

            function addPopup() {
            	// Don't add the popup if it already exists
                if (_this.map.listens('mousemove')) { return }

                var onMouseMove : Function = MapboxMap.debounce(function(e) {
                    let minpoint = new Array(e.point['x'] - 5, e.point['y'] - 5)
                    let maxpoint = new Array(e.point['x'] + 5, e.point['y'] + 5)
                    let features : any = _this.map.queryRenderedFeatures([minpoint, maxpoint], {
                        layers: ['heatmap-1']
                    });

                    if (!features.length) {
                        _this.map.getCanvas().style.cursor = '';
                        _this.popup.remove();
                        return
                    }

                    _this.map.getCanvas().style.cursor = 'pointer';

                    let feat = features[0];
                    let tooltip = feat.properties.tooltip;

                    _this.popup.setLngLat(_this.map.unproject(e.point))
                        .setHTML("<div><h3>Tooltip</h3>"+
                            "<li>Value: " + tooltip + "<li></div>")
                        .addTo(_this.map);

                }, 16, false);
               
            	_this.map.on('mousemove', onMouseMove);
	        }

            function addClick() {
                _this.map.off('click');

                var onClick : Function = MapboxMap.debounce(function(e) {
                    let minpoint = new Array(e.point['x'] - 5, e.point['y'] - 5)
                    let maxpoint = new Array(e.point['x'] + 5, e.point['y'] + 5)
                    let features : any = _this.map.queryRenderedFeatures([minpoint, maxpoint], {
                        layers: ['circle-1', 'circle-2']
                    });

                    if (!features.length) {return}

                    _this.map.easeTo({
                        center: features[0].geometry.coordinates,
                        zoom: 15,
                        duration: 500
                    });
                }, 16, true);
               
                _this.map.on('click', onClick);
            };
            

        function runload() {
            onUpdate();
            addPopup();
            addClick();

            let bounds : any = turf.bbox(turf.featureCollection(features));

            _this.map.easeTo( {
                duration: 500,
                pitch: 0,
                bearing: 0
            });
            _this.map.fitBounds(bounds, {
                padding: 25,
                duration: 500
            });
            _this.firstRun = false;
        }

        // If running update for the first time, wait for the load event
        if (_this.firstRun) {
            _this.map.once('load', runload);
        }
        else {
            //If refreshing the map, update the map if it's already fully rendered
            if (_this.map.loaded) {
                runload();
            }
            else {
                //If refreshing the map and existing data is still loading, update when finished loading
                _this.map.on('sourcedata', runload);
            }  
        }
        
    }

        @logExceptions()
        public destroy(): void {
            console.log("removing map with destroy")
            this.map.remove();
        }
    }
}