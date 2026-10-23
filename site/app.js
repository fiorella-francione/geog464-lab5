// BEHAVIOUR: what happens on the page when someone clicks. Runs top to bottom when the page loads.

const map = L.map('map', { preferCanvas: true }).setView([45.5017, -73.5673], 12);

const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

map.createPane('gridPane');
map.getPane('gridPane').style.zIndex = 350;
map.createPane('parkingPane');
map.getPane('parkingPane').style.zIndex = 450;

const heatClasses = {
  'Température plus froide que la moyenne': {
    label: 'Cooler than average'
  },
  'Îlot de fraicheur': {
    label: 'Cool island'
  },
  'Température proche de la moyenne': {
    label: 'Near-average temperature'
  },
  'Zones à risque': {
    label: 'At-risk zones'
  },
  'Îlot de chaleur': {
    label: 'Heat island'
  }
};

function getHeatLabel(classQual) {
  return heatClasses[classQual] ? heatClasses[classQual].label : 'Unknown';
}

const temperatureColors = ['#2c7bb6', '#abd9e9', '#ffffbf', '#fdae61', '#d7191c'];
let temperatureMin;
let temperatureMax;

function parseTemperature(value) {
  return value === null || value === undefined || value === '' ? NaN : Number(value);
}

function colourFor(value) {
  const temperature = parseTemperature(value);
  if (!Number.isFinite(temperature) || temperatureMin === undefined || temperatureMax === undefined) {
    return '#999999';
  }
  if (temperatureMin === temperatureMax) {
    return temperatureColors[2];
  }
  const classIndex = Math.min(
    temperatureColors.length - 1,
    Math.floor((temperature - temperatureMin) / (temperatureMax - temperatureMin) * temperatureColors.length)
  );
  return temperatureColors[Math.max(0, classIndex)];
}

function addTemperatureLegend() {
  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'legend');
    let items;

    if (temperatureMin === undefined || temperatureMax === undefined) {
      items = '<div>No grid temperature data</div>';
    } else if (temperatureMin === temperatureMax) {
      items = '<div><span style="background:' + temperatureColors[2] + '"></span>' +
        temperatureMin.toFixed(1) + ' °C</div>';
    } else {
      const interval = (temperatureMax - temperatureMin) / temperatureColors.length;
      items = temperatureColors.map(function (color, index) {
        const lower = temperatureMin + interval * index;
        const upper = index === temperatureColors.length - 1
          ? temperatureMax
          : temperatureMin + interval * (index + 1);
        return '<div><span style="background:' + color + '"></span>' +
          lower.toFixed(1) + '–' + upper.toFixed(1) + ' °C</div>';
      }).join('');
    }

    div.innerHTML = '<strong>Mean heat temperature</strong><br>' + items;
    return div;
  };
  legend.addTo(map);
}

const gridFile = '../data/borough_heat_grid.geojson';
const parkingFile = '../data/parking_boroughs_heat.geojson';

Promise.all([
  fetch(gridFile).then(function (response) {
    if (!response.ok) { throw new Error('HTTP ' + response.status + ' loading borough_heat_grid.geojson'); }
    return response.json();
  }),
  fetch(parkingFile).then(function (response) {
    if (!response.ok) { throw new Error('HTTP ' + response.status + ' loading parking_boroughs_heat.geojson'); }
    return response.json();
  })
]).then(function (datasets) {
  const gridData = datasets[0];
  const parkingData = datasets[1];
  const gridTemperatures = gridData.features
    .map(function (feature) { return parseTemperature(feature.properties.mean_temp); })
    .filter(Number.isFinite);

  if (gridTemperatures.length > 0) {
    temperatureMin = Math.min.apply(null, gridTemperatures);
    temperatureMax = Math.max.apply(null, gridTemperatures);
  } else {
    console.warn('No valid mean_temp values found in borough_heat_grid.geojson.');
  }

  const gridLayer = L.geoJSON(gridData, {
    pane: 'gridPane',
    style: function (feature) {
      const color = colourFor(feature.properties.mean_temp);
      return {
        color: '#555555',
        weight: 0.3,
        fillColor: color,
        fillOpacity: 0.65
      };
    },
    onEachFeature: function (feature, layer) {
      const temperature = parseTemperature(feature.properties.mean_temp);
      const temperatureLabel = Number.isFinite(temperature)
        ? temperature.toFixed(1) + ' °C'
        : 'Not available';
      layer.bindPopup(
        'Grid cell: ' + feature.properties.cell_id + '<br>' +
        'Parking points: ' + feature.properties.parking_points + '<br>' +
        'Mean heat temperature: ' + temperatureLabel
      );
    }
  }).addTo(map);

  const boroughFilter = document.getElementById('borough-filter');
  const parkingLayer = L.geoJSON(null, {
    pane: 'parkingPane',
    pointToLayer: function (feature, latlng) {
      return L.marker(latlng, {
        icon: L.divIcon({
          className: 'parking-marker-icon',
          html: '<span class="parking-symbol">P</span>',
          iconSize: [12, 12],
          iconAnchor: [12, 12]
        })
      });
    },
    onEachFeature: function (feature, layer) {
      const p = feature.properties;
      const temperature = parseTemperature(p.TempMoyVF);
      const temperatureLabel = Number.isFinite(temperature)
        ? temperature.toFixed(1) + ' °C'
        : 'Not available';
      layer.bindPopup(
        'Street: ' + p.sNomRue + '<br>' +
        'Hourly rate: ' + p.nTarifHoraire + '&cent;<br>' +
        'Heat category: ' + getHeatLabel(p.ClassQual) + '<br>' +
        'Average temperature: ' + temperatureLabel
      );
    }
  }).addTo(map);

  function showFeatures() {
    const selectedBorough = boroughFilter.value;
    const filteredFeatures = selectedBorough === 'all'
      ? parkingData.features
      : parkingData.features.filter(function (feature) {
        return feature.properties.NOM === selectedBorough;
      });

    parkingLayer.clearLayers();
    parkingLayer.addData({
      type: 'FeatureCollection',
      features: filteredFeatures
    });

    const boroughLabel = selectedBorough === 'all' ? 'all boroughs' : selectedBorough;
    document.getElementById('status').textContent =
      filteredFeatures.length + ' parking spaces shown in ' + boroughLabel;
  }

  boroughFilter.addEventListener('change', showFeatures);
  showFeatures();

  L.control.layers(
    { 'Streets': streets },
    { 'Urban heat grid (mean °C)': gridLayer, 'Parking points': parkingLayer },
    { collapsed: false }
  ).addTo(map);

  addTemperatureLegend();
}).catch(function (err) {
  document.getElementById('status').textContent =
    'Could not load the grid or parking points. Open the console (F12) for details.';
  console.error(err);
});
