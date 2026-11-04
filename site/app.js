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
const parkingFile = '../data/parking_cluster.geojson';

Promise.all([
  fetch(gridFile).then(function (response) {
    if (!response.ok) { throw new Error('HTTP ' + response.status + ' loading borough_heat_grid.geojson'); }
    return response.json();
  }),
  fetch(parkingFile).then(function (response) {
    if (!response.ok) { throw new Error('HTTP ' + response.status + ' loading parking_cluster.geojson'); }
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

  // A3 search and filter for boroughs
  const boroughFilter = document.getElementById('borough-filter');
  const boroughSearch = document.getElementById('borough-search');
  const boroughSearchInput = document.getElementById('borough-search-input');
  const boroughSuggestions = document.getElementById('borough-suggestions');
  const minimumHeatClass = document.getElementById('minimum-heat-class');
  const candidateList = document.getElementById('candidate-list');
  const boroughNames = Array.from(new Set(parkingData.features.map(function (feature) {
    return feature.properties.NOM;
  })));
  function normalizeBorough(name) {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

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
        'Parking points grouped: ' + p.n_points + '<br>' +
        'Example street: ' + p.sNomRue + '<br>' +
        'Example hourly rate: ' + p.nTarifHoraire + '&cent;<br>' +
        'Maximum heat class: ' + p.ClassesNB_ + ' — ' + getHeatLabel(p.ClassQual) + '<br>' +
        'Average temperature: ' + temperatureLabel
      );
    }
  }).addTo(map);

  function renderShortlist(borough) {
    candidateList.replaceChildren();

    if (borough === 'all') {
      candidateList.appendChild(document.createElement('li'))
        .textContent = 'Choose a borough to see its hottest candidates.';
      return;
    }

    const boroughFeatures = parkingData.features.filter(function (feature) {
      return feature.properties.NOM === borough;
    });
    const temperatures = boroughFeatures
      .map(function (feature) { return parseTemperature(feature.properties.TempMoyVF); })
      .filter(Number.isFinite);
    if (temperatures.length === 0) {
      candidateList.appendChild(document.createElement('li'))
        .textContent = 'No temperature data is available for this borough.';
      return;
    }

    if (boroughFeatures.some(function (feature) {
      return !Number.isFinite(parseTemperature(feature.properties.ClassesNB_));
    })) {
      candidateList.appendChild(document.createElement('li'))
        .textContent = 'Heat-class data is missing. Rerun the notebook heat join and clustering export.';
      return;
    }

    const boroughAverage = temperatures.reduce(function (sum, value) {
      return sum + value;
    }, 0) / temperatures.length;
    const minimumClass = minimumHeatClass.value === 'all'
      ? null
      : Number(minimumHeatClass.value);
    const candidates = boroughFeatures
      .filter(function (feature) {
        return minimumClass === null ||
          Number(feature.properties.ClassesNB_) >= minimumClass;
      })
      .filter(function (feature) {
        return Number.isFinite(parseTemperature(feature.properties.TempMoyVF));
      })
      .sort(function (a, b) {
        return Number(b.properties.TempMoyVF) - Number(a.properties.TempMoyVF);
      })
      .slice(0, 10);

    if (candidates.length === 0) {
      candidateList.appendChild(document.createElement('li'))
        .textContent = 'No locations meet this minimum heat class in ' + borough + '.';
      return;
    }

    candidates.forEach(function (feature, index) {
      const properties = feature.properties;
      const temperature = Number(properties.TempMoyVF);
      const difference = temperature - boroughAverage;
      const roundedDifference = Math.round(difference * 10) / 10;
      const differenceLabel = (roundedDifference >= 0 ? '+' : '−') +
        Math.abs(roundedDifference).toFixed(1) + ' °C vs borough candidate average';
      const hourlyRate = parseTemperature(properties.nTarifHoraire);
      const rateLabel = Number.isFinite(hourlyRate)
        ? '$' + (hourlyRate / 100).toFixed(2) + '/hour'
        : 'Rate unavailable';
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'candidate-row';
      button.setAttribute(
        'aria-label',
        'Rank ' + (index + 1) + ', ' + properties.sNomRue + ', ' +
        properties.n_points + ' parking points, ' +
        temperature.toFixed(1) + ' degrees Celsius, ' + differenceLabel + ', ' + rateLabel
      );

      const address = document.createElement('span');
      address.className = 'candidate-address';
      address.textContent = (index + 1) + '. ' + (properties.sNomRue || 'Address unavailable');
      const details = document.createElement('span');
      details.className = 'candidate-details';
      details.textContent = properties.n_points + ' parking points · ' +
        temperature.toFixed(1) + ' °C · ' + differenceLabel + ' · ' + rateLabel;
      button.append(address, details);

      button.addEventListener('click', function () {
        let marker;
        parkingLayer.eachLayer(function (layer) {
          const markerProperties = layer.feature.properties;
          if (markerProperties.NOM === properties.NOM &&
              markerProperties.lot_id === properties.lot_id) {
            marker = layer;
          }
        });
        if (marker) {
          map.setView(marker.getLatLng(), Math.max(map.getZoom(), 16));
          marker.openPopup();
        }
      });

      item.appendChild(button);
      candidateList.appendChild(item);
    });
  }

  function showFeatures(borough) {
    const selectedBorough = borough || boroughFilter.value;
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
      filteredFeatures.length + ' clustered parking locations shown in ' + boroughLabel;
    renderShortlist(selectedBorough);
  }
  function selectBorough(borough) {
    boroughFilter.value = borough;
    showFeatures(borough);
    const bounds = parkingLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
    }
    boroughSuggestions.hidden = true;
    boroughSuggestions.replaceChildren();
  }

  boroughSearchInput.addEventListener('input', function () {
    const searchName = normalizeBorough(boroughSearchInput.value);
    boroughSuggestions.replaceChildren();

    if (!searchName) {
      boroughSuggestions.hidden = true;
      return;
    }

    const matches = boroughNames.filter(function (name) {
      return normalizeBorough(name).startsWith(searchName);
    });

    matches.forEach(function (name) {
      const option = document.createElement('button');
      option.type = 'button';
      option.textContent = name;
      option.addEventListener('click', function () {
        boroughSearchInput.value = name;
        selectBorough(name);
      });
      boroughSuggestions.appendChild(option);
    });
    boroughSuggestions.hidden = matches.length === 0;
  });

  boroughSearch.addEventListener('submit', function (event) {
    event.preventDefault();
    const searchName = normalizeBorough(boroughSearchInput.value);
    const matchingBorough = boroughNames.find(function (name) {
      return normalizeBorough(name) === searchName;
    });

    if (!matchingBorough) {
      document.getElementById('status').textContent = 'Borough not found, try again';
      return;
    }

    selectBorough(matchingBorough);
  });

  boroughFilter.addEventListener('change', function () {
    selectBorough(boroughFilter.value);
  });
  minimumHeatClass.addEventListener('change', function () {
    renderShortlist(boroughFilter.value);
  });
  showFeatures();

  L.control.layers(
    { 'Streets': streets },
    { 'Urban heat grid (mean °C)': gridLayer, 'Clustered parking locations': parkingLayer },
    { collapsed: false }
  ).addTo(map);

  addTemperatureLegend();
}).catch(function (err) {
  document.getElementById('status').textContent =
    'Could not load the grid or clustered parking locations. Open the console (F12) for details.';
  console.error(err);
});
