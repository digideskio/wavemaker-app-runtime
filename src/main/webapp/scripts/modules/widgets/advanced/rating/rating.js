/*global WM */
/*Directive for rating widget */

WM.module('wm.widgets.advanced')
    .run(['$templateCache', '$rootScope', function ($templateCache, $rootScope) {
        'use strict';

        $templateCache.put('template/widget/advanced/rating.html',
            '<div data-ng-model="_model_" data-ng-show="show" class="app-ratings" init-widget has-model' + $rootScope.getWidgetStyles() + '>' +
                '<div data-ng-if="!readonly" class="rating-style">' +
                '<label data-ng-class="{active : rate.value <= datavalue}" for="{{$id}}+{{rate.value}}" data-ng-style="{\'font-size\':iconsize}" data-ng-repeat="rate in range track by $index" title="{{rate.value}}">' +
                    '<input type="radio" id="{{$id}}+{{rate.value}}" data-ng-click="getActiveStars($event)" name="{{ratingname}}" value="{{rate.value}}"/>' +
                '</label>' +
                '</div>' +
                '<div data-ng-if="readonly" data-ng-style="{\'font-size\':iconsize}" class="ratings-container disabled count-{{maxvalue}}" >' +
                    '<div class="ratings active" data-ng-style="{width: ratingsWidth()}"></div>' +
                '</div>' +
                '<label class="caption"></label>' +
            '</div>'
             );
    }])
    .directive('wmRating', ['PropertiesFactory', 'WidgetUtilService', function (PropertiesFactory, WidgetUtilService) {
        'use strict';

        var widgetProps = PropertiesFactory.getPropertiesOf('wm.rating', ['wm.base', 'wm.base.editors']),
            notifyFor = {
                'maxvalue': true,
                'readonly': true
            };
        /* Define the property change handler. This function will be triggered when there is a change in the widget property */
        function propertyChangeHandler(scope, key, newVal) {
            switch (key) {
            case 'maxvalue':
                var range = [],
                    i,
                    MAX_RATING = 5;
                for (i = parseInt(newVal, 10) || MAX_RATING; i > 0; i--) {
                    range.push({"value": i});
                }
                scope.range = range;
                scope.ratingname = "ratings-" + scope.$id;
                break;
            }
        }

        return {
            'restrict': 'E',
            'replace': true,
            'scope': {},
            'template': WidgetUtilService.getPreparedTemplate.bind(undefined, 'template/widget/advanced/rating.html'),
            'compile': function () {
                return {
                    'pre': function (scope) {
                        /*Applying widget properties to directive scope*/
                        scope.widgetProps = widgetProps;

                    },
                    'post': function (iScope, $el, attrs) {
                        iScope.getActiveStars = function ($event) {
                            iScope._model_ = $el.find(':checked').val();
                            iScope._onChange($event);
                        };
                        iScope.ratingsWidth = function () {
                            return 100 * (iScope.datavalue / iScope.maxvalue) + '%';
                        };
                        WidgetUtilService.registerPropertyChangeListener(propertyChangeHandler.bind(undefined, iScope), iScope, notifyFor);
                        WidgetUtilService.postWidgetCreate(iScope, $el, attrs);

                    }
                };
            }
        };
    }]);

/**
 * @ngdoc directive
 * @name wm.widgets.form.directive:wmRating
 * @restrict E
 *
 * @description
 * The `wmRating` directive defines the rating widget.
 *
 * @scope
 *
 * @requires PropertiesFactory
 * @requires WidgetUtilService
 * @requires $sce
 *
 * @param {string=} caption
 *                  This property specifies the label of the rating. <br>
 *                  This property is bindable.
 * @param {string=} name
 *                  Name of the rating widget.
 * @param {boolean=} show
 *                  Show is a bindable property. <br>
 *                  This property will be used to show/hide the button widget on the web page. <br>
 *                  Default value: `true`. <br>
 * @param {boolean=} disabled
 *                  Disabled is a bindable property. <br>
 *                  This property will be used to disable/enable the button widget on the web page. <br>
 *                  Default value: `false`. <br>
 * @param {string=} on-click
 *                  Callback function which will be triggered when the widget is clicked.
 * @example
 *   <example module="wmCore">
 *       <file name="index.html">
 *           <div data-ng-controller="Ctrl" class="wm-app">
 *               <wm-rating
 *                   caption="{{caption}}"
 *                   on-click="f('click');"
 *                   datavalue="{{datavalue}}"
 *                   maxvalue="{{maxvalue}}"
 *                   >
 *               </wm-rating><br>
 *               <wm-composite>
 *                   <wm-label caption="caption:"></wm-label>
 *                   <wm-text scopedatavalue="caption"></wm-text>
 *               </wm-composite>
 *           </div>
 *       </file>
 *       <file name="script.js">
 *          function Ctrl($scope) {
 *              $scope.maxvalue = 5;
 *              $scope.datavalue = 2;
 *              $scope.f = function (eventtype) {
 *                  $scope[eventtype + 'Count']++;
 *              }
 *           }
 *       </file>
 *   </example>
 */
