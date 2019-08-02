'use strict'

let stopLocs = [];

// Services for map
let directionsDisplay = null;
let placeService = null;
let directionsService = null;

// The inputs for location
let givenOrigin = '';
let givenEnd = '';


// Sets up the map and related services
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

    // Add event listerners to both of the autocomplete input fields
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

// Clear current stored results
function reset() {
    $('#stop-list').empty();
    stopLocs = [];
}
  
// Get initial set of directions from the users entered start to the
// entered end location
function getInitDirections() {

    if ($('#drive-hours').val() != "" &&  givenOrigin != '' && givenEnd != '') {
        $(".results").removeClass("hidden");
        $('#stop-list').html('<h3>Loading.....</h3>');
        getDirections(givenOrigin, givenEnd);
    }
}


// Get directions from current found stop to given end location
function getDirections(origin, end) {
    directionsService.route({
    origin: origin,
    destination: end,
    travelMode: 'DRIVING'
    }, function(response, status) {

        if (status === 'OK') {
            findStops(response);
        } else {
            window.alert('Directions request failed due to ' + status);
            ('#stop-list').empty();
        }
    });
}


// Go through each step given in the direction results 
// and find at what point the time driven is equal to 
// the given time limit. Add this point to stopLocs
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

// Checks if the current driving time for the day
// is more than the drive time limit given by user
function atTimeLimit(stepTime, totTime) {
    let driveTime = $('#drive-hours')[0].value * 3600;
    if (totTime + stepTime > driveTime) {
        return driveTime - totTime;
    } else {
        return 0;
    }
}



// Retrieve the location that is approxamentaly 
// at the drive time limit
function getSearchCenter(neededTime, step) {

    let ratio = neededTime / step.duration.value;
    let numPoints = step.path.length;
    let basePoint = Math.floor(numPoints * ratio);
    
    let searchCenter = step.path[basePoint];
    return searchCenter;
}

// Re-calculate directions with all of the stop locations
// entered as waypoints and render this on the map
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
          
            // Render directions on map
            directionsDisplay.setDirections(response);
           
           // Clear stop list of any current results
            $('#stop-list').empty();

            // For each stop, add info to the list
            let legs = response.routes[0].legs;
            for (let i = 0; i < legs.length; i++) {
                addStop(i + 1, legs[i].start_address, legs[i].end_address, 
                legs[i].duration.text, legs[i].distance.text);
                getWeather(legs[i].end_location,i + 1);
            }
          
        } else {
            window.alert('Directions request failed due to ' + status);
            $('#stop-list').empty();
        }
    });
}

// Add stop to the results section
function addStop(day, start, end, duration, miles) {
    $('#stop-list').append(
        `<li>
            <ul class="day-sum day${day}">
                <li class="day">Day ${day}</li>
                <li class="start"><b>Start (${String.fromCharCode(64 + day)}):</b> ${start}</li>
                <li class="end"><b>End (${String.fromCharCode(65 + day)}):</b> ${end}</li>
                <li class="drive-length"><b>Drive Length:</b> ${duration} (${miles})</li>
            </ul>
        </li>`
    );
}

// Using fetch, retrives the weather for a giver location
function getWeather(coords, day) {
  let lat = coords.lat();
  let long = coords.lng();
  let apiEndPoint = 'https://api.openweathermap.org/data/2.5/weather';
  let apiId = '74deda482573e0aeec696e9630c3504e';
  fetch(`${apiEndPoint}?lat=${lat}&lon=${long}&appid=${apiId}`)  
  .then(response => response.json())
  .then(responseJson => {
    let kTmp = responseJson.main.temp;
    let cTmp = kTmp - 273;
    let fTmp = Math.floor(cTmp * 9/5 + 32);
    $(`.day${day}`).append(`<li><b>Current weather at End Location:</b> ${fTmp} °F</li>`);
  })
  .catch(error =>  {
    console.log(error);
  });
}


// Monitors drive hours input for change
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