'use strict'

let stopLocs = [];

// Services for map
let directionsDisplay = null;
let placeService = null;
let directionsService = null;

// The inputs for location
let givenOrigin = '';
let givenEnd = '';

let fullTripTime = '';

function reset() {
  $('#stop-list').empty();
  stopLocs = [];
}

function getInitDirections() {
  if ($('#drive-hours').val() != "" &&  givenOrigin != '' && givenEnd != '') {
    $('#stop-list').html('<h3>Loading.....</h3>');
    getDirections(givenOrigin, givenEnd);
  }
}

function getWeather(coords, day) {
  let lat = coords.lat();
  let long = coords.lng();
  fetch(`http://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${long}&appid=74deda482573e0aeec696e9630c3504e`)  
  .then(response => response.json())
  .then(responseJson => {
    let kTmp = responseJson.main.temp;
    let cTmp = kTmp - 273;
    let fTmp = Math.floor(cTmp * 9/5 + 32);
    $(`#stop-list li:nth-child(${day})`).append(`<p>Current weather: ${fTmp} degrees F</p>`);
  })
  .catch(error =>  {
    console.log(error);
  });
}

function initMap() {

    // Create map centered on USA
    let map = new google.maps.Map(document.getElementById('map'), {
      zoom: 5,
      center: {lat: 41.850033, lng: -87.6500523}
    });

    // Create services to be used later
    directionsService = new google.maps.DirectionsService;
    directionsDisplay = new google.maps.DirectionsRenderer({map: map});

    
    let startInput = new google.maps.places.Autocomplete($('#start-location')[0]);
    let endInput = new google.maps.places.Autocomplete($('#end-location')[0]);

    startInput.addListener('place_changed', function() {
      let place = startInput.getPlace();
      if (!place.geometry) {
        // User entered the name of a Place that was not suggested and
        // pressed the Enter key, or the Place Details request failed.
        window.alert("No details available for input: '" + place.name + ". Please re-enter location.'");
        return;
      } else {
        reset();
        givenOrigin = place.geometry.location;
        getInitDirections();
      }
    });

    endInput.addListener('place_changed', function() {
      let place = endInput.getPlace();
      if (!place.geometry) {
        // User entered the name of a Place that was not suggested and
        // pressed the Enter key, or the Place Details request failed.
        window.alert("No details available for input: '" + place.name + ". Please re-enter location'");
        return;
      } else {
        reset();
        givenEnd = place.geometry.location;
        getInitDirections();
      }
    });   
}


function getDirections(origin, end) {
  directionsService.route({
    origin: origin,
    destination: end,
    travelMode: 'DRIVING'
  }, function(response, status) {

    if (status === 'OK') {
      if (!fullTripTime) {
        fullTripTime = response.routes[0].legs[0].duration.value;
      }
      findStops(response);
    } else {
      window.alert('Directions request failed due to ' + status);
      ('#stop-list').empty();
    }
  });
}

function findStops(directionResult) {

    let myRoute = directionResult.routes[0].legs[0];
    let totTime = 0;

    for (let i = 0; i < myRoute.steps.length; i++) {
        let timeLeft = atTimeLimit(myRoute.steps[i].duration.value, totTime);
      if (timeLeft) {
          let searchCenter = getSearchCenter(timeLeft,myRoute.steps[i]);
          stopLocs.push({location: searchCenter,stopover: true});
            getDirections(searchCenter, givenEnd);
            break;
      } else {
        totTime += myRoute.steps[i].duration.value;
      }

      if (i == myRoute.steps.length - 1) {
        showStops(stopLocs);
      }
    }
}


function atTimeLimit(stepTime, totTime) {
    let driveTime = $('#drive-hours')[0].value * 3600;
    if (totTime + stepTime > driveTime) {
        return driveTime - totTime;
    } else {
        return 0;
    }
}

function addStop(day, start, end, duration, miles) {
    $('#stop-list').append(
        `<li>Day ${day}
        <br>
        <p>Start: ${start}</p>
        <p>End: ${end}</p>
        <p>Drive Length: ${duration} (${miles})</p>
        </li>`
    );
}

function getSearchCenter(neededTime, step) {

    let ratio = neededTime / step.duration.value;
    let numPoints = step.path.length;
    let basePoint = Math.floor(numPoints * ratio);
    
    let searchCenter = step.path[basePoint];
    return searchCenter;
}

function showStops(stopLocs) {
    let directionsService = new google.maps.DirectionsService;
    directionsService.route({
        origin: givenOrigin,
        destination: givenEnd,
        waypoints: stopLocs,
        optimizeWaypoints: true,
        travelMode: 'DRIVING'
      }, function(response, status) {
        if (status === 'OK') {
          directionsDisplay.setDirections(response);
          $('#stop-list').empty();
          let legs = response.routes[0].legs;
          for (let i = 0; i < legs.length; i++) {
            getWeather(legs[i].end_location,i + 1);
            addStop(i + 1, legs[i].start_address, legs[i].end_address, 
              legs[i].duration.text, legs[i].distance.text);
          }
          
        } else {
          window.alert('Directions request failed due to ' + status);
          $('#stop-list').empty();
        }
      });
}
$(function() {
  $('#drive-hours').change(e => {
    if ($('#drive-hours').val() < 1) {
      window.alert('Number of hours must be at least 1.');
    } else {
      reset();
      getInitDirections();
    }
  });
})