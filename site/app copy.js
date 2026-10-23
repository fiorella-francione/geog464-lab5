// BEHAVIOUR: what happens on the page when someone clicks. Runs top to bottom when the page loads.

// Loads map into view of Montreal
const map = L.map('map', { preferCanvas: true }).setView([45.5017, -73.5673], 12);  // [latitude, longitude]: Montreal

// Base map: OpenStreetMap.
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// How many parking spaces to draw
const LIMIT = Infinity;
const boroughColors = {
  'Verdun': '#19b888',
  'Rosemont-La Petite-Patrie': '#d95f02',
  'Outremont': '#7570b3',
  'Ville-Marie': '#e7298a',
  'Le Plateau-Mont-Royal': '#478106',
  'Le Sud-Ouest': '#e6ab02',
  'Ahuntsic-Cartierville': '#c37afa',
  'Côte-des-Neiges-Notre-Dame-de-Grâce': '#1f78b4'
};

// Load the parking.geojson file and add it to the map
fetch('../data/parking.geojson')
  .then(function (response) {
    if (!response.ok) { throw new Error('HTTP ' + response.status + ' loading parking.geojson'); }
    return response.json();
  })
  .then(function (data) {
    const hFeatures = data.features;
    const boroughFilter = document.getElementById('borough-filter');
    let parkingLayer;

    // Draws the parking spaces on the map, filtered by borough
    function showFeatures() {
      const selectedBorough = boroughFilter.value;
      const filteredFeatures = selectedBorough === 'all'
        ? hFeatures
        : hFeatures.filter(function (feature) {
          return feature.properties.Borough === selectedBorough;
        });
      const shown = {
        type: 'FeatureCollection',
        features: filteredFeatures.slice(0, LIMIT)
      };
      if (parkingLayer) {
        map.removeLayer(parkingLayer);
      }

      // Draw the parking spaces as circle markers coloured by borough
      parkingLayer = L.geoJSON(shown, {
        pointToLayer: function (feature, latlng) {
          return L.circleMarker(latlng, {
            radius: 6,
            color: '#ffffff',
            weight: 1,
            fillColor: boroughColors[feature.properties.Borough] || '#9f9c9c',
            fillOpacity: 1
          });
        },
        // Popup for each point
        onEachFeature: function (feature, layer) {
          const p = feature.properties;
          layer.bindPopup(
            'Hourly rate: ' + p['Hourly rate'] + '&cent;<br>' +
            'Street Name: ' + p['Street Name'] + '<br>' +
            'Borough: ' + p.Borough
          );
        }
      }).addTo(map);

      // Update the status text with the number of spaces shown and the selected borough
      const boroughLabel = selectedBorough === 'all' ? 'all boroughs' : selectedBorough;
      document.getElementById('status').textContent =
        shown.features.length + ' parking spaces shown in ' + boroughLabel;
    }

    boroughFilter.addEventListener('change', showFeatures);
    showFeatures();
  })
  .catch(function (err) {
    document.getElementById('status').textContent =
      'Could not load parking.geojson. Open the console (F12) for details.';
    console.error(err);
  });

// Making a legend
const legend = L.control({ position: 'bottomright' });
legend.onAdd = function () {
  const div = L.DomUtil.create('div', 'legend');
  div.innerHTML = Object.keys(boroughColors).map(function (name) {
    return '<div><span style="background:' + boroughColors[name] + '"></span>' + name + '</div>';   // one row: coloured dot + name
  }).join(''); 
  return div;
};
legend.addTo(map);