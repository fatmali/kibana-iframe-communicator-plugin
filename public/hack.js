import $ from 'jquery';
import _ from 'lodash';
import 'ui/courier';
import 'ui/index_patterns';
import 'ui/modals/confirm_modal_promise';
const uiModules = require('ui/modules');
const rison = require('rison-node');

$;
_;

/*// hook into angular's application lifecycle example
uiModules.get('kibana').run(function ($rootScope, $location) {
    // attempt to inject the control every time the route changes or updates
  $rootScope.$on('$routeChangeSuccess', injectControl);
  $rootScope.$on('$routeUpdate', injectControlB);

  function injectControl() {
    console.log("$routeChangeSuccess");
    console.log($location.url());
  }
  function injectControlB() {
    console.log("$routeUpdate");
    console.log($location.url());
  }
});*/

// hook into dashboard kibana lifecycle
uiModules.get('app/dashboard', ['kibana/courier', 'ngRoute'])
  .run(function ($rootScope, Private, $location, courier, $route, kbnUrl, getAppState, globalState, timefilter) {
    // parses url
    function getQueryVariable(variable, query) {
      const vars = query.split('&');
      for (let i = 0; i < vars.length; i++) {
        const pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) === variable) {
          return decodeURIComponent(pair[1]);
        }
      }
      console.log('Query variable %s not found', variable);
    }

    let doNotSendRouteChangeNotificationToParent = false;

    // Create IE + others compatible message event handler
    const eventMethod = window.addEventListener ? 'addEventListener' : 'attachEvent';
    const eventer = window[eventMethod];
    const messageEvent = eventMethod === 'attachEvent' ? 'onmessage' : 'message';

    let lastReceievedData = null;
    let startAcceptingEvents = false;

    const eventMessageHandler = function (e) {

      console.debug('received message!:  ', e.data);
      lastReceievedData = e;
      if (!startAcceptingEvents) {
        console.warn('Ignoring event as we can\'t accept events yet!');
        return;
      }

      const splitMsg = e.data.split('###');
      if (splitMsg.length !== 2) {
        console.warn('Invalid message!');
        return;
      }
      const topic = splitMsg[0];
      const urlData = splitMsg[1];
      let indexOfDashSign;
      let finalUri;

      switch (topic) {
        case 'searchRequest': // in case we got a search request:
          console.debug('Search request...');
          // parse the app + global states:
          const passedInAppState = rison.decode(getQueryVariable('_a', urlData));
          const passedInGlobalState = rison.decode(getQueryVariable('_g', urlData));

          // get the local kibana app + global states:
          const localAppState = getAppState();
          const localGlobalState = globalState;

          // and now lets apply the filters:
          localAppState.query.query_string.query = passedInAppState.query.query_string.query;
          //localGlobalState
          localGlobalState.time.from = passedInGlobalState.time.from;
          localGlobalState.time.mode = passedInGlobalState.time.mode;
          localGlobalState.time.to = passedInGlobalState.time.to;
          // timefilter:
          timefilter.time.from = passedInGlobalState.time.from;
          timefilter.time.mode = passedInGlobalState.time.mode;
          timefilter.time.to = passedInGlobalState.time.to;

          indexOfDashSign = urlData.indexOf('#');
          finalUri = urlData.substr(indexOfDashSign + 1);
          // update the url to correctly reflect new state (this will update the time filter and search bar in the UI):

          doNotSendRouteChangeNotificationToParent = true; // we do not want to send to our parent of the change (as he was the one who iniated this...)

          $location.url(finalUri);
          // go and get the data with the new filters:
          //localAppState.save();
          courier.fetch();




          // now we can re-listen and notify of INTERNAL changes:
          setTimeout(() => { doNotSendRouteChangeNotificationToParent = false; }, 1000);

          return;
        case 'routeRequest': // in case we were requsted to route to a different area:

          console.debug('Route request...');
          lastReceievedData = null; // make sure we don't trigger the lastReceievedData  in routeChangeSuccess
          startAcceptingEvents = false; // we stop accepting events (we keep the last request anyways) - as accepting changes while loading a dashboard results in
          indexOfDashSign = urlData.indexOf('#');
          finalUri = urlData.substr(indexOfDashSign + 1);
          doNotSendRouteChangeNotificationToParent = true; // we do not want to send to our parent of the change (as he was the one who iniated this...)
          kbnUrl.change(finalUri);
          // now we can re-listen and notify of INTERNAL changes:
          setTimeout(() => { doNotSendRouteChangeNotificationToParent = false; }, 1000);
          return;
      }


      console.warn('Invalid message topic ' + topic + '!');



    };

    // Listen to message from parent (or any other) window
    eventer(messageEvent, eventMessageHandler, false);


    $rootScope.$on('$routeUpdate', () => // on route updates
    {
      if (parent && !doNotSendRouteChangeNotificationToParent) // if we are truly hosted in an iframe
      {
        // update parent with current updated url data:
        parent.postMessage('kibanaUpdateNotification###' + $location.url(), '*');
      }
    });
    /*
      $rootScope.$on('$routeUpdate', () =>
      {
          console.debug("RECIVED $routeUpdate!")
      });

       $rootScope.$on('$init:config', () =>
      {
          console.debug("RECIVED $init:config!")
      });

       $rootScope.$on('$locationChangeSuccess', () =>
      {
          console.debug("RECIVED $locationChangeSuccess!")
      });


       $rootScope.$on('$routeChangeStart', () =>
      {
          console.debug("RECIVED $routeChangeStart!")
      });*/



    $rootScope.$on('$routeChangeSuccess', () => {
      console.debug('RECIVED $routeChangeSuccess!');
      if (!startAcceptingEvents) // starting to recieve external events (we use this event as it's the last event possible to wait for)
      {
        startAcceptingEvents = true;
        if (lastReceievedData) // if we have a previous request we haven't taken care of yet - let's take care of it now
        {
          setTimeout(() => eventMessageHandler(lastReceievedData), 1000);  // we set a timeout as we must make sure
        }
      }
    });

  });
