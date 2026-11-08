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

const priorityColors = ['#398b98', '#e6a14a', '#80a967', '#d97870', '#9272b1'];
let priorityMin;
let priorityMax;
const temperatureColors = ['#4b8f9b', '#89aa78', '#e6b253', '#dc8769', '#b95d5a'];
let temperatureMin;
let temperatureMax;

function parseNumber(value) {
  return value === null || value === undefined || value === '' ? NaN : Number(value);
}

function colourForPriority(value) {
  const score = parseNumber(value);
  if (!Number.isFinite(score) || priorityMin === undefined || priorityMax === undefined) {
    return '#999999';
  }
  if (priorityMin === priorityMax) {
    return priorityColors[0];
  }
  const classIndex = Math.min(
    priorityColors.length - 1,
    Math.floor((score - priorityMin) / (priorityMax - priorityMin) * priorityColors.length)
  );
  return priorityColors[Math.max(0, classIndex)];
}

function colourForTemperature(value) {
  const temperature = parseNumber(value);
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

function addPriorityLegend() {
  const div = document.getElementById('priority-legend');
  let items;

  if (priorityMin === undefined || priorityMax === undefined) {
    items = '<div>No priority scores</div>';
  } else if (priorityMin === priorityMax) {
    items = '<div><span style="background:' + priorityColors[0] + '"></span>' +
      'All locations have the same score</div>';
  } else {
    const interval = (priorityMax - priorityMin) / priorityColors.length;
    items = priorityColors.map(function (color, index) {
      const lower = priorityMin + interval * index;
      const upper = index === priorityColors.length - 1
        ? priorityMax
        : priorityMin + interval * (index + 1);
      return '<div><span style="background:' + color + '"></span>' +
        lower.toFixed(1) + '–' + upper.toFixed(1) + '</div>';
    }).join('');
  }

  div.innerHTML = '<strong>Priority score (0–100)</strong><br>' +
    '<small>Higher score = higher priority</small>' + items;
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
const parkingFile = '../data/parking_priority.geojson';

Promise.all([
  fetch(gridFile).then(function (response) {
    if (!response.ok) { throw new Error('HTTP ' + response.status + ' loading borough_heat_grid.geojson'); }
    return response.json();
  }),
  fetch(parkingFile).then(function (response) {
    if (!response.ok) { throw new Error('HTTP ' + response.status + ' loading parking_priority.geojson'); }
    return response.json();
  })
]).then(function (datasets) {
  const gridData = datasets[0];
  const parkingData = datasets[1];
  const gridTemperatures = gridData.features
    .map(function (feature) { return parseNumber(feature.properties.mean_temp); })
    .filter(Number.isFinite);
  if (gridTemperatures.length > 0) {
    temperatureMin = Math.min.apply(null, gridTemperatures);
    temperatureMax = Math.max.apply(null, gridTemperatures);
  } else {
    console.warn('No valid mean_temp values found in borough_heat_grid.geojson.');
  }

  const scores = parkingData.features
    .map(function (feature) { return parseNumber(feature.properties.priority_score); })
    .filter(Number.isFinite);
  if (scores.length > 0) {
    priorityMin = Math.min.apply(null, scores);
    priorityMax = Math.max.apply(null, scores);
  } else {
    console.warn('No valid priority_score values found in parking_priority.geojson.');
  }

  const gridLayer = L.geoJSON(gridData, {
    pane: 'gridPane',
    style: function (feature) {
      return {
        color: '#f4f1eb',
        weight: 0.45,
        fillColor: colourForTemperature(feature.properties.mean_temp),
        fillOpacity: 0.78
      };
    },
    onEachFeature: function (feature, layer) {
      const temperature = parseNumber(feature.properties.mean_temp);
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
          html: '<span class="parking-symbol" style="background:' +
            colourForPriority(feature.properties.priority_score) + '">P</span>',
          iconSize: [12, 12],
          iconAnchor: [12, 12]
        })
      });
    },
    onEachFeature: function (feature, layer) {
      const p = feature.properties;
      const temperature = parseNumber(p.TempMoyVF);
      const temperatureLabel = Number.isFinite(temperature)
        ? temperature.toFixed(1) + ' °C'
        : 'Not available';
      layer.bindPopup(
        '<strong>' + (p.sNomRue || 'Address unavailable') + '</strong><hr>' +
        'Heat class at cluster location: ' + p.ClassesNB_ + ' — ' + getHeatLabel(p.ClassQual) + '<br>' +
        'Average temperature: ' + temperatureLabel + '<br>' +
        'Priority score: ' + Number(p.priority_score).toFixed(1) + ' / 100<br>' +
        'Borough priority rank: ' + p.priority_rank + '<br>' +
        'Hourly rate: ' + p.nTarifHoraire + '&cent;<br>' 
      );
    }
  }).addTo(map);

  function renderShortlist(borough) {
    candidateList.replaceChildren();
    document.getElementById('candidate-instructions').hidden = borough === 'all';

    if (borough === 'all') {
      candidateList.appendChild(document.createElement('li'))
        .textContent = 'Choose a borough to see its highest-priority candidates.';
      return;
    }

    const boroughFeatures = parkingData.features.filter(function (feature) {
      return feature.properties.NOM === borough;
    });
    if (boroughFeatures.some(function (feature) {
      return !Number.isFinite(parseNumber(feature.properties.priority_score)) ||
        !Number.isFinite(parseNumber(feature.properties.n_points));
    })) {
      candidateList.appendChild(document.createElement('li'))
        .textContent = 'Priority data is missing. Rebuild the parking priority GeoJSON.';
      return;
    }

    const minimumClass = minimumHeatClass.value === 'all'
      ? null
      : Number(minimumHeatClass.value);
    const candidates = boroughFeatures
      .filter(function (feature) {
        return minimumClass === null ||
          Number(feature.properties.ClassesNB_) >= minimumClass;
      })
      .sort(function (a, b) {
        return Number(b.properties.priority_score) - Number(a.properties.priority_score);
      })
      .slice(0, 10);

    if (candidates.length === 0) {
      candidateList.appendChild(document.createElement('li'))
        .textContent = 'No locations meet this minimum heat class in ' + borough + '.';
      return;
    }

    candidates.forEach(function (feature) {
      const properties = feature.properties;
      const temperature = Number(properties.TempMoyVF);
      const hourlyRate = parseNumber(properties.nTarifHoraire);
      const rateLabel = Number.isFinite(hourlyRate)
        ? '$' + (hourlyRate / 100).toFixed(2) + '/hour'
        : 'Rate unavailable';
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'candidate-row';
      button.setAttribute(
        'aria-label',
        'Priority rank ' + properties.priority_rank + ', ' + properties.sNomRue + ', ' +
        properties.n_points + ' parking points, ' +
        'heat class ' + properties.ClassesNB_ + ', priority score ' +
        Number(properties.priority_score).toFixed(1) + ' out of 100, ' + rateLabel
      );

      const address = document.createElement('span');
      address.className = 'candidate-address';
      address.textContent = '#' + properties.priority_rank + ' · ' +
        (properties.sNomRue || 'Address unavailable');
      const details = document.createElement('span');
      details.className = 'candidate-details';
      details.textContent = 'Score ' + Number(properties.priority_score).toFixed(1) + '/100' +
        ' · Heat class ' + properties.ClassesNB_ + ' · ' + properties.n_points +
        ' parking points · ' + (Number.isFinite(temperature) ? temperature.toFixed(1) + ' °C' : 'Temperature unavailable') +
        ' · ' + rateLabel;
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
    { 'Street map': streets },
    {
      'Urban heat grid (mean °C)': gridLayer,
      'Priority-ranked parking locations': parkingLayer
    },
    { collapsed: false }
  ).addTo(map);

  addTemperatureLegend();
  addPriorityLegend();
}).catch(function (err) {
  document.getElementById('status').textContent =
    'Could not load the heat grid or priority-ranked parking locations. Open the console (F12) for details.';
  console.error(err);
});
