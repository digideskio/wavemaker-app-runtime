/*global WM, _, document*/

WM.module('wm.layouts.page')
    .directive('wmPage', [
        'DeviceViewService',
        'CONSTANTS',
        '$rootScope',
        '$routeParams',
        'Utils',
        '$timeout',
        'Variables',
        'NavigationVariableService',
        '$location',

        function (DeviceViewService, CONSTANTS, $rs, $routeParams, Utils, $timeout, Variables, NavigationVariableService, $location) {
            'use strict';

            var appVariableReadyFired = false;

            return {
                'restrict'  : 'E',
                'replace'   : true,
                'transclude': true,
                'template'  : '<div data-role="pageContainer" class="app-page container" ng-class="layoutClass" wmtransclude no-animate></div>',
                'link'      :  {
                    'pre': function ($s, $el, attrs) {
                        var pageName,
                            variableScope,
                            containerScope,
                            count,
                            subView;

                        /* if the page belongs to a prefab use the name of the prefab
                         * else if the project is of prefab type use `Main`
                         * else get the name of the page from the ng-controller attribute
                         */
                        pageName = $s.prefabname
                                        || ($rs.isPrefabTemplate && 'Main')
                                        || attrs.ngController.replace('PageController', '');

                        variableScope = CONSTANTS.isStudioMode && !$s.prefabname && !$s.$parent.partialname ? $rs.domScope : $s;

                        if (CONSTANTS.isRunMode) {
                            $s.Variables = {};
                            $s.Widgets   = {};
                            $rs.pageParams = $s.pageParams = $location.search();
                            // only expose the widgets of the active page to rootScope
                            if (!$s.$parent.partialname && !$s.prefabname) {
                                $rs.Widgets       = $s.Widgets;
                                $rs.$activePageEl = $el;
                            }
                            if ($s.$parent.partialname) {
                                // get partial page container's scope
                                containerScope = $s.$parent.Widgets && $s.$parent.Widgets[$s.$parent.partialcontainername];

                                // expose partial's Widgets to its container's scope (to be visible to parent)
                                if (containerScope) {
                                    containerScope.Widgets = $s.Widgets;
                                }
                            }

                            // update the title of the application
                            if ($routeParams.name === $rs.activePageName) {
                                document.title = attrs.pagetitle || $rs.activePageName + ' - ' + $rs.projectName;
                            }
                        }

                        if (CONSTANTS.isStudioMode) {
                            containerScope = $s.$parent.Widgets && $s.$parent.Widgets[$s.$parent.partialcontainername];
                            if (containerScope && WM.isDefined(containerScope.Widgets)) {
                                containerScope.Widgets = $s.Widgets = {};
                            }
                        }
                        // define registerPageContainer and onPageContainerLoad methods in Run Mode.
                        if (!$s.registerPageContainer && CONSTANTS.isRunMode) {
                            count = 0;

                            $s.layout = {
                                'leftSection' : false,
                                'rightSection': false,
                                'header'      : false,
                                'footer'      : false,
                                'search'      : false
                            };

                            $s.onPageLoad = function () {
                                // if the count is zero(means the page is ready), trigger update method of DeviceViewService
                                if (!count) {
                                    /* if subview element names found (appended with page-name after a '.'), navigate to the view element */
                                    if ($routeParams && $routeParams.name) {
                                        subView = $routeParams.name.split('.');
                                        if (subView.length > 1) {
                                            NavigationVariableService.goToView(subView.pop());
                                        }
                                    }
                                    // update layout after the page is rendered
                                    $s.layout.search       = $el.find('[data-role="page-header"] .app-search');
                                    $s.layout.leftSection  = $el.find('[data-role="page-left-panel"]').length > 0;
                                    $s.layout.rightSection = $el.find('[data-role="page-right-panel"]').length > 0;

                                    // update the device after some delay
                                    $timeout(function () {
                                        //trigger the onPageReady method
                                        if ($s.hasOwnProperty('onPageReady')) {
                                            Utils.triggerFn($s.onPageReady);
                                        }
                                        DeviceViewService.update($el, $s.layout.leftSection, $s.layout.rightSection, $s.layout.search);
                                        $rs.$$postDigest(function () {
                                            /* triggering the event post digest, so that any expression watches are computed before the same*/
                                            $rs.$emit('page-ready');
                                        });
                                    });
                                }
                            };

                            // increment the counter when a pageContainer is registered
                            $s.registerPagePart = function () {
                                count++;
                            };

                            $s.onPagePartLoad = function () {
                                --count; // decrement the counter when the a pageContainer is ready
                                $s.onPageLoad();
                            };

                            // if specified, call handle route function in the page.js
                            if (WM.isFunction($s.handleRoute)) {
                                // gather all the routeParams, send them as arguments to the fn except first element, as first element is pageName
                                $s.handleRoute.apply(undefined, _.values($routeParams).slice(1));
                            }
                        }

                        // register the page variables
                        Variables.getPageVariables(pageName, function (variables) {
                            Variables.register(pageName, variables, true, variableScope);

                            // expose partial page's Variabes to its container's scope (to be visible to parent)
                            if (containerScope) {
                                containerScope.Variables = $s.Variables;
                            }

                            // if specified, call page variables ready function in the page.js
                            if (!appVariableReadyFired) {
                                Utils.triggerFn($rs.onAppVariablesReady, $rs.Variables);
                                appVariableReadyFired = true;
                            }

                            Utils.triggerFn($s.onPageVariablesReady);
                        });
                    },
                    'post': function ($s, $el, attrs) {
                        var handlers = [];
                        //check if the view is run mode then initialize the mobile behavior
                        if (CONSTANTS.isRunMode) {
                            // register session timeout handler
                            handlers.push($rs.$on('on-sessionTimeout', $s.onSessionTimeout));

                            Utils.triggerFn($s.onPageLoad);
                            $el.on('$destroy', function () {
                                // destroy variables
                                Variables.unload(attrs.ngController.replace('PageController', ''), $s);
                                handlers.forEach(Utils.triggerFn);
                            });
                        }
                    }
                }
            };
        }
    ])
    .directive('wmPartial', [
        'CONSTANTS',
        '$rootScope',
        'Utils',
        'Variables',

        function (CONSTANTS, $rs, Utils, Variables) {
            'use strict';

            return {
                'restrict'   : 'E',
                'replace'    : true,
                'transclude' : true,
                'template'   : '<section data-role="partial" class="app-partial clearfix" wmtransclude></section>',
                'link'       : {
                    'pre': function ($s, $el, attrs) {
                        var pageName,
                            variableScope,
                            containerScope;

                        pageName      = attrs.ngController.replace('PageController', '');
                        variableScope = CONSTANTS.isStudioMode && !$s.prefabname && !$s.$parent.partialname ? $rs.domScope : $s;

                        if (CONSTANTS.isRunMode) {
                            $s.Widgets   = {};
                            $s.Variables = {};

                            // get partial container's scope
                            containerScope = $s.$parent.Widgets && $s.$parent.Widgets[$s.$parent.partialcontainername];

                            // expose partial's Widgets to its container's scope (to be visible to parent)
                            if (containerScope) {
                                containerScope.Widgets = $s.Widgets;
                            }
                        }

                        if (CONSTANTS.isStudioMode) {
                            containerScope = $s.$parent.Widgets && $s.$parent.Widgets[$s.$parent.partialcontainername];
                            if (containerScope && WM.isDefined(containerScope.Widgets)) {
                                containerScope.Widgets = $s.Widgets = {};
                            }
                        }

                        Variables.getPageVariables(pageName, function (variables) {
                            Variables.register(pageName, variables, true, variableScope);

                            // expose partial's Variables to its container's scope (to be visible to parent)
                            if (CONSTANTS.isRunMode && containerScope) {
                                containerScope.Variables = $s.Variables;
                            }
                        });
                    },
                    'post': function ($s, $el, attrs) {

                        var handlers = [];
                        //check if the view is run mode then initialize the mobile behavior
                        if (CONSTANTS.isRunMode) {
                            // register session timeout handler
                            handlers.push($rs.$on('on-sessionTimeout', function () {
                                Utils.triggerFn($s.onSessionTimeout);
                            }));
                            // trigger onPageReady method if it is defined in the controller of partial
                            if ($s.hasOwnProperty('onPageReady')) {
                                Utils.triggerFn($s.onPageReady);
                            }
                            // canvasTree will listen for this event and will hide itself upon occurrence of it
                            $el.on('$destroy', function () {
                                // destroy loaded variables
                                Variables.unload(attrs.ngController.replace('PageController', ''), $s);
                                handlers.forEach(Utils.triggerFn);
                            });
                        }
                    }
                }
            };
        }
    ]);

/**
 * @ngdoc directive
 * @name wm.layouts.page.directive:wmPage
 * @restrict E
 *
 * @description
 * The 'wmPage' directive defines a page in the layout.
 * It is the main container which encloses the layout elements (Header, Nav bar, Content, Footer, Left and Right Panel).
 * It can optionally have views as child containers (As in case of a dialog).
 * It contains the layout definition (One column, two column etc).
 *
 * @requires DeviceViewService
 *
 * @param {string=} layouttype
 *                  Type of the layout.
 * @param {string=} columns
 *                  Number of columns in the content, this is required for dom manipulation in mobile view.<br>
 * @param {string=} data-ng-controller
 *                  The name of the controller for the page.
 *
 * @example
    <example module="wmCore">
        <file name="index.html">
            <div class="wm-app">
                <wm-page data-ng-controller="MainPageController">
                    <wm-header height="50" backgroundcolor="teal">Content of Header</wm-header>
                     <wm-top-nav height="30" backgroundcolor="tomato">Content of TopNav</wm-top-nav>
                     <wm-content>
                         <wm-left-panel columnwidth="2" backgroundcolor="#fd4c70">Content of LeftNav</wm-left-panel>
                         <wm-page-content columnwidth="8" backgroundcolor="#0097a4">Content of Page</wm-page-content>
                         <wm-right-panel columnwidth="2" backgroundcolor="#934cfd">Content of RightNav</wm-right-panel>
                     </wm-content>
                     <wm-footer backgroundcolor="#f66f8a">Content of Footer</wm-footer>
                </wm-page>
            </div>
        </file>
        <file name="script.js">
            function MainPageController($scope) {}
        </file>
    </example>
 */


/**
 * @ngdoc directive
 * @name wm.layouts.page.directive:wmPartial
 * @restrict E
 *
 * @description
 * The 'wmPartial' directive defines a part of a page in the layout. <br>
 * Page container widgets(eg, header, footer etc) can include wmPartials.
 *
 *
 * @param {string=} data-ng-controller
 *                  The name of the controller for the page.
 *
 * @example
    <example module="wmCore">
        <file name="index.html">
            <div class="wm-app">
                <wm-partial data-ng-controller="MainPageController">
                    <wm-button caption="button1" backgroundcolor="cadetblue"></wm-button>
                </wm-partial>
            </div>
        </file>
        <file name="script.js">
            function MainPageController ($scope) {}
        </file>
    </example>
 */
