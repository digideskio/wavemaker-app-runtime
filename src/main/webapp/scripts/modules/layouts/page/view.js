/*global WM*/

WM.module('wm.layouts.page')
    .run(['$templateCache', function ($templateCache) {
        'use strict';
        $templateCache.put('template/layout/page/view.html',
                '<div init-widget class="app-view" data-ng-show="show" apply-styles="container" wmtransclude wm-navigable-element="true"> </div>'
            );
    }])
    .directive('wmView', ['PropertiesFactory', 'WidgetUtilService', 'CONSTANTS', 'ViewService', 'Utils', function (PropertiesFactory, WidgetUtilService, CONSTANTS, ViewService, Utils) {
        'use strict';
        var widgetProps = PropertiesFactory.getPropertiesOf('wm.layouts.view', ['wm.layouts', 'wm.base.events.touch']);

        return {
            'restrict': 'E',
            'replace': true,
            'scope': {},
            'transclude': true,
            'template': WidgetUtilService.getPreparedTemplate.bind(undefined, 'template/layout/page/view.html'),
            'compile': function () {
                return {
                    'pre': function (scope) {
                        /*Applying widget properties to directive scope*/
                        scope.widgetProps = widgetProps;
                    },
                    'post': function (scope, element, attrs) {
                        ViewService.registerView(scope);
                        scope.setActive = function () {
                            ViewService.showView(scope.name);
                        };
                        var isDialogView = element.hasClass('dialog-view');
                        if (isDialogView) {
                            if (CONSTANTS.isStudioMode) {
                                /* dialog view is meant to have the dialog only, widgets should not be dropped on the same,
                                 * so making the dialog-view non-droppable
                                 * */

                                element.attr('wm-droppable', false);
                            }

                            if (CONSTANTS.isRunMode) {
                                /* hiding the dialog-view in run mode, just opening the dialog*/
                                scope.show = false;
                            }
                        }
                        scope.initialize = function () {
                            element.find('.ng-isolate-scope')
                                .each(function () {
                                    Utils.triggerFn(WM.element(this).isolateScope().redraw);
                                });
                        };

                        WidgetUtilService.postWidgetCreate(scope, element, attrs);
                        element.on('$destroy', function () {
                            ViewService.unregisterView(scope);
                        });
                    }
                };
            }
        };
    }]);

/**
 * @ngdoc directive
 * @name wm.layouts.page.directive:wmView
 * @restrict E
 *
 * @description
 * The 'wmView' directive defines a view in the layout.
 * View is a container which can be added onto some specific containers (example - page, column).
 *
 * @scope
 *
 * @requires PropertiesFactory
 * @requires WidgetUtilService
 * @requires CONSTANTS
 * @requires ViewService
 *
 * @param {string=} horizontalalign
 *                  Align the content in the right panel to left/right/center.<br>
 *                  Default value for horizontalalign is `left`.
 * @param {string=} on-swipeup
 *                  Callback function for `swipeup` event.
 * @param {string=} on-swipedown
 *                  Callback function for `swipedown` event.
 * @param {string=} on-swiperight
 *                  Callback function for `swiperight` event.
 * @param {string=} on-swipeleft
 *                  Callback function for `swipeleft` event.
 * @param {string=} on-pinchin
 *                  Callback function for `pinchin` event.
 * @param {string=} on-pinchdown
 *                  Callback function for `pinchdown` event.
 *
 * @example
    <example module="wmCore">
        <file name="index.html">
            <div class="wm-app" data-ng-controller="Ctrl">
                <button data-ng-click="showView = true">Show View</button>
                <button data-ng-click="showView = false">Hide View</button>
                <wm-container>
                    <wm-view show="{{showView}}" backgroundcolor="teal"> Content of View </wm-view>
                </wm-container>
            </div>
        </file>
        <file name="script.js">
            function Ctrl($scope) {}
        </file>
    </example>
 */

