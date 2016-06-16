/*global WM*/
/*Directive for Panel*/

WM.module('wm.layouts.containers')
    .run(['$templateCache', function ($templateCache) {
        'use strict';
        $templateCache.put('template/layout/container/panel.html',
            '<div page-container init-widget listen-property="actions" class="app-panel panel" ng-class="[helpClass, {\'fullscreen\':fullscreen}]" apply-styles="shell" wm-navigable-element="true">' +
                '<div class="panel-heading" ng-class="helpClass">' +
                    '<h3 class="panel-title">' +
                        '<a href="javascript:void(0)" class="panel-toggle" ng-click="expandCollapsePanel()">' +
                            '<div class="pull-left"><i class="app-icon panel-icon {{iconclass}}" ng-show="iconclass"></i></div>' +
                            '<div class="pull-left">' +
                                '<div class="heading">{{title}}</div>' +
                                '<div class="description">{{subheading}}</div>' +
                             '</div>' +
                        '</a>' +
                        '<div class="panel-actions">' +
                            '<span ng-if="badgevalue" class="label label-{{badgetype}}">{{badgevalue}}</span>' +
                            '<wm-menu type="anchor" class="panel-action" scopedataset="actions" iconclass="wi wi-more-vert" ng-if="actions" title="{{::$root.appLocale.LABEL_ACTIONS}}" on-select="onActionsclick({$item:$item})" datafield="{{datafield}}" itemlabel="{{binditemlabel}}" menuposition="down,left" itemicon="{{binditemicon || itemicon}}" itemlink="{{binditemlink || itemlink}}" itemchildren="{{binditemchildren || itemchildren}}"></wm-menu>' +
                            '<button type="button" class="app-icon panel-action wi wi-question" title="{{::$root.appLocale.LABEL_HELP}}" ng-if="helptext" ng-click="toggleHelp()"></button>' +
                            '<button type="button" class="app-icon wi panel-action" ng-if="collapsible" title="{{::$root.appLocale.LABEL_COLLAPSE}}/{{::$root.appLocale.LABEL_EXPAND}}" ng-class="expanded ? \'wi-minus\': \'wi-plus\'" ng-click="expandCollapsePanel($event);"></button>' +
                            '<button type="button" class="app-icon wi panel-action" ng-if="enablefullscreen" title="{{::$root.appLocale.LABEL_FULLSCREEN}}/{{::$root.appLocale.LABEL_EXITFULLSCREEN}}" ng-class="fullscreen ? \'wi-fullscreen-exit\': \'wi-fullscreen\'" ng-click="toggleFullScreen($event);"></button>' +
                            '<button type="button" class="app-icon wi panel-action wi-close" title="{{::$root.appLocale.LABEL_CLOSE}}" ng-if="closable" ng-click="closePanel();onClose({$event: $event, $scope: this})"></button>' +
                        '</div>' +
                    '</h3>' +
                '</div>' +
                '<div class="panel-content" ng-show="expanded">' +
                    '<div class="panel-body" ng-class="helpClass" wmtransclude page-container-target apply-styles="inner-shell"></div>' +
                    '<aside class="panel-help-message" ng-class="helpClass"><h5 class="panel-help-header">{{::$root.appLocale.LABEL_HELP}}</h5><div class="panel-help-content" ng-bind-html="helptext"></div></aside>' +
                '</div>' +
            '</div>'
            );
        $templateCache.put('template/layout/container/panel-footer.html', '<div class="app-panel-footer panel-footer" ng-show="expanded" wmtransclude></div>');
    }])
    .directive('wmPanel', ['PropertiesFactory', 'WidgetUtilService', 'Utils', 'CONSTANTS', function (PropertiesFactory, WidgetUtilService, Utils, CONSTANTS) {
        'use strict';
        var widgetProps = PropertiesFactory.getPropertiesOf('wm.layouts.panel', ['wm.base', 'wm.base.events.touch', 'wm.menu.dataProps']),
            notifyFor = {
                'actions': true
            };
        /* Define the property change handler. This function will be triggered when there is a change in the widget property */
        function propertyChangeHandler(scope, key, newVal) {
            switch (key) {
            case 'actions':
                scope.itemlabel = scope.itemlabel || scope.displayfield;
                break;
            }
        }
        return {
            'restrict'  : 'E',
            'replace'   : true,
            'scope'     : {},
            'transclude': true,
            'template'  : function (tElement, tAttrs) {
                var isWidgetInsideCanvas = tAttrs.hasOwnProperty('widgetid'),
                    template = WM.element(WidgetUtilService.getPreparedTemplate('template/layout/container/panel.html', tElement, tAttrs));

                if (!isWidgetInsideCanvas) {
                    if (tAttrs.hasOwnProperty('onEnterkeypress')) {
                        template.attr('ng-keypress', 'onKeypress({$event: $event, $scope: this})');
                    }
                }
                return template[0].outerHTML;
            },
            'controller': function () {
                this.registerFooter = function (footer) {
                    this.footer = footer;
                };
            },
            'compile': function (tElement) {
                return {
                    'pre': function (iScope, element, attrs) {
                        if (CONSTANTS.isStudioMode) {
                            iScope.widgetProps = Utils.getClonedObject(widgetProps);
                        } else {
                            iScope.widgetProps = widgetProps;
                        }
                        //handle the backward compatibility for description attributes
                        if (attrs.description && !attrs.subheading) {
                            iScope.subheading = attrs.subheading = attrs.description;
                            WM.element(tElement.context).attr('subheading', iScope.subheading);
                            delete attrs.description;
                        }
                    },
                    'post': function (scope, element, attrs, panelCtrl) {
                        if (scope.expanded === undefined) {
                            scope.expanded = true;
                        }
                        /* Expand Collapse the panel */
                        scope.expandCollapsePanel = function ($event) {
                            if (scope.collapsible) {
                                if (scope.expanded) {
                                    if (scope.onCollapse) {
                                        scope.onCollapse({$event: $event, $scope: this});
                                    }
                                } else {
                                    if (scope.onExpand) {
                                        scope.onExpand({$event: $event, $scope: this});
                                    }
                                }
                                /* flip the active flag */
                                scope.expanded = !scope.expanded;
                                if (panelCtrl.footer) {
                                    panelCtrl.footer.isolateScope().expanded = scope.expanded;
                                }
                            }
                        };
                        /* Toggle FullScreen the panel */
                        scope.toggleFullScreen = function ($event) {
                            if (scope.enablefullscreen) {
                                if (scope.fullscreen) {
                                    if (scope.onExitfullscreen) {
                                        scope.onExitfullscreen({$event: $event, $scope: this});
                                    }
                                } else {
                                    if (scope.onFullscreen) {
                                        scope.onFullscreen({$event: $event, $scope: this});
                                    }
                                }
                                /* flip the active flag */
                                scope.fullscreen = !scope.fullscreen;
                            }
                        };

                        /* toggle the state of the panel */
                        scope.toggleHelp = function () {
                            /* flip the active flag */
                            scope.helpClass = scope.helpClass ? null : 'show-help';
                        };
                        /* Close the panel */
                        scope.closePanel = function () {
                            scope.show = false;
                        };
                        /* register the property change handler */
                        WidgetUtilService.registerPropertyChangeListener(propertyChangeHandler.bind(undefined, scope), scope, notifyFor);
                        WidgetUtilService.postWidgetCreate(scope, element, attrs);

                        if (!scope.widgetid) {
                            scope.onKeypress = function (args) {
                                var action = Utils.getActionFromKey(args.$event);
                                if (action === 'ENTER') {
                                    scope.onEnterkeypress(args);
                                }
                            };
                        }

                        if (panelCtrl.footer) {
                            element.append(panelCtrl.footer);
                        }
                    }
                };
            }
        };
    }])
    .directive('wmPanelFooter', ['$templateCache', function ($templateCache) {
        'use strict';
        return {
            'restrict'  : 'E',
            'replace'   : true,
            'scope'     : {},
            'transclude': true,
            'require'   : '^wmPanel',
            'template'  : $templateCache.get('template/layout/container/panel-footer.html'),
            'link'      : function (scope, element, attrs, panelCtrl) {
                scope.expanded = true;
                panelCtrl.registerFooter(element);
            }
        };
    }]);

/**
 * @ngdoc directive
 * @name wm.layouts.containers.directive:wmPanel
 * @restrict E
 * @element ANY
 * @description
 * The 'wmPanel' directive defines a panel in the page.
 * @scope
 *
 * @requires PropertiesFactory
 * @requires WidgetUtilService
 * @requires Utils
 * @requires CONSTANTS
 *
 * @param {string=} title
 *                  Title of the panel widget. This property is a bindable property.
 * @param {string=} name
 *                  Name of the panel widget.
 * @param {string=} description
 *                  Description for the panel widget. This property is a bindable property.
 * @param {string=} width
 *                  Width of the panel widget.
 * @param {string=} height
 *                  Height of the panel widget.
 * @param {boolean=} showheader
 *                  Show/Hide header of the panel widget.
 * @param {string=} content
 *                  Sets content for the panel widget. <br>
 *                  Page's content will be included in the widget.<br>
 *                  Default value: `Inline Content`. <br>
 * @param {string=} helptext
 *                  To show help text for the panel widget. Help panel on the right is shown only when help text is given. This property is a bindable property.
 * @param {boolean=} show
 *                  Show is a bindable property. <br>
 *                  This property will be used to show/hide the panel widget on the web page. <br>
 *                  Default value: `true`. <br>
 * @param {boolean=} collapsible
 *                  To enable control for collapsing/expanding the panel widget.
 * @param {boolean=} enablefullscreen
 *                  To enable fullscreen view for the panel widget
 * @param {boolean=} closable
 *                  To apply close button in the panel widget.
 * @param {string=} actions
 *                  To set the actions for the panel widget. This property is a bindable property.
 * @param {boolean=} expanded
 *                  To set the default state for the panel widget, whether it is expanded or collapsed.
 * @param {string=} animation
 *                  This property controls the animation of the panel widget. <br>
 *                  The animation is based on the css classes and works only in the run mode. <br>
 *                  Possible values are `bounce`, `flash`, `pulse`, `rubberBand`, `shake`, etc.
 * @param {string=} iconclass
 *                  To define class of icon applied to the button for the panel widget. This property is a bindable property.
 * @param {string=} horizontalalign
 *                  Align the content in the panel to left/right/center.<br>
 * @param {string=} mouseover
 *                  Callback function which will be triggered when the mouse moves over the panel.
 * @param {string=} mouseout
 *                  Callback function which will be triggered when the mouse away from the panel.
 * @param {string=} mouseenter
 *                  Callback function which will be triggered when the mouse enters inside the panel.
 * @param {string=} mouseleave
 *                  Callback function which will be triggered when the mouse leaves the panel.
 * @param {string=} enterkeypress
 *                  Callback function which will be triggered when the user hits the ENTER/Return while the focus is on this editor.
 * @param {string=} swipeup
 *                  Callback function which will be triggered when the panel is swiped up.
 * @param {string=} swipedown
 *                  Callback function which will be triggered when the panel is swiped down.
 * @param {string=} swiperight
 *                  Callback function which will be triggered when the panel is swiped right.
 * @param {string=} swipeleft
 *                  Callback function which will be triggered when the panel is swiped left.
 * @param {string=} pinchin
 *                  Callback function which will be triggered when the panel is pinched in.
 * @param {string=} pinchout
 *                  Callback function which will be triggered when the panel is pinched out.
 * @param {string=} on-close
 *                  Callback function which will be triggered when the panel is closed.
 * @param {string=} on-expand
 *                  Callback function which will be triggered when the panel is expanded.
 * @param {string=} on-collapse
 *                  Callback function which will be triggered when the panel is collapsed.
 * @param {string=} on-actions-click
 *                  Callback function which will be triggered when the action icon is clicked.
 * @example
    <example module="wmCore">
        <file name="index.html">
            <div ng-controller="Ctrl" class="wm-app">
                <wm-panel class="panel-default" collapsible="true"  enablefullscreen="true" showheader="true" width="400" height="200" backgroundcolor="#dad8d9" title="Personal Info">
                    <wm-panel-footer>
                        <wm-container horizontalalign="right">
                            <wm-button class="btn-secondary" caption="Cancel" type="button"></wm-button>
                            <wm-button class="btn-primary" caption="Update" type="button"></wm-button>
                        </wm-container>
                    </wm-panel-footer>
                    <wm-composite>
                        <wm-label class="col-md-3" caption="First Name:"></wm-label>
                        <wm-container class="col-md-9">
                            <wm-text></wm-text>
                        </wm-container>
                    </wm-composite>
                    <wm-composite>
                        <wm-label class="col-md-3" caption="Last Name:"></wm-label>
                        <wm-container class="col-md-9">
                            <wm-text></wm-text>
                        </wm-container>
                    </wm-composite>
                </wm-panel>
            </div>
        </file>
        <file name="script.js">
            function Ctrl($scope) {}
        </file>
    </example>
 */