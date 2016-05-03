/*global WM, window, _, document, Hammer*/
/*jslint todo: true */
/*Directive for liveList */

WM.module('wm.widgets.live')
    .run(['$templateCache', function ($tc) {
        'use strict';

        $tc.put('template/widget/list.html',
                '<div class="app-livelist panel" ng-class="navigation" init-widget live-actions apply-styles="shell" ng-show="show">' +
                    '<div class="form-header panel-heading" ng-if="title">' +
                        '<h4 class="panel-title">' +
                            '<i class="{{iconclass}}" ng-style="{width:iconwidth, height:iconheight, margin:iconmargin}"></i>' +
                            '<span>{{title}}</span>' +
                        '</h4>' +
                    '</div>' +
                    '<nav class="app-datanavigator" ng-if="navigation === \'Inline\'" >' +
                        '<ul class="pager"><li class="previous" ng-class="{\'disabled\': dataNavigator.isDisablePrevious}"><a href="javascript:void(0);" ' +
                            'ng-click="dataNavigator.navigatePage(\'prev\', $event)"><i class="wi wi-chevron-left"></i></a></li></ul>' +
                    '</nav>' +
                    '<ul data-identifier="list" class="app-livelist-container clearfix" title="{{hint}}" ng-show="!noDataFound" ng-class="listclass" wmtransclude ' +
                             'ng-style="{height: height, overflow: overflow, paddingTop: paddingtop + paddingunit, paddingRight: paddingright + paddingunit, paddingLeft: paddingleft + paddingunit, paddingBottom: paddingbottom + paddingunit}">' +
                    '</ul>' +
                    '<div class="no-data-msg" ng-show="noDataFound">{{::$root.appLocale.MESSAGE_LIVELIST_NO_DATA}}</div>' +
                    '<nav class="app-datanavigator" ng-if="navigation === \'Inline\'">' +
                        '<ul class="pager"><li class="next" ng-class="{\'disabled\': dataNavigator.isDisableNext}"><a href="javascript:void(0);" ' +
                            'ng-click="dataNavigator.navigatePage(\'next\', $event)"><i class="wi wi-chevron-right"></i></a></li></ul>' +
                    '</nav>' +
                    '<div class="panel-footer" ng-if="navigation !== \'None\'" ng-show="navigation !== \'Inline\'">' +
                        '<wm-datanavigator showrecordcount="{{show && showrecordcount}}" navigationalign="{{navigationalign}}" navigation="{{navControls}}" maxsize="{{maxsize}}" boundarylinks="{{boundarylinks}}" forceellipses="{{forceellipses}}" directionlinks="{{directionlinks}}"></wm-datanavigator>' +
                    '</div>' +
                '</div>'
            );

    }])
    .controller('listController', [

        function () {
            'use strict';
            var _map = {};

            this.$set = function (key, value) {
                _map[key] = value;
            };

            this.$get = function (key) {
                return _map[key].clone(true);
            };
        }
    ])
    .directive('wmLivelist', [
        'WidgetUtilService',
        'PropertiesFactory',
        '$templateCache',
        'CONSTANTS',
        '$compile',
        'Utils',
        '$rootScope',
        '$servicevariable',
        '$timeout',
        'DeviceVariableService',
        'LiveWidgetUtils',
        'FormWidgetUtils',

        function (WidgetUtilService, PropertiesFactory, $tc, CONSTANTS, $compile, Utils , $rs, $servicevariable, $timeout, DeviceVariableService, LiveWidgetUtils, FormWidgetUtils) {
            'use strict';

            var widgetProps             = PropertiesFactory.getPropertiesOf('wm.livelist', ['wm.base', 'wm.base.editors', 'wm.base.events', 'wm.base.navigation']),
                liTemplateWrapper_start,
                liTemplateWrapper_end,
                notifyFor = {
                    'dataset'     : true,
                    'height'      : true,
                    'groupby'     : true,
                    'navigation'  : CONSTANTS.isStudioMode,
                    'itemsperrow' : CONSTANTS.isStudioMode
                },
                directiveDefn,
                NAVIGATION = {
                    'BASIC'    : 'Basic',
                    'CLASSIC'  : 'Classic',
                    'ADVANCED' : 'Advanced',
                    'SCROLL'   : 'Scroll',
                    'INLINE'   : 'Inline',
                    'PAGER'    : 'Pager'
                };

            // to return the bootstrap classes for the <li> w.r.t no. of items per row
            function getRowClass(itemsperrow) {
                if (!itemsperrow) {
                    return undefined;
                }
                var col = itemsperrow && 12 / (+itemsperrow);

                return $rs.isMobileApplicationType ?  ' col-xs-' + col : 'col-sm-' + col;
            }

            function getVariable($is, variableName) {

                if (!variableName) {
                    return undefined;
                }

                var variables = $is.Variables || {};
                return variables[variableName];
            }

            // to get the list of columns from the dataSet/scopeDataSet
            function getColumnsFromDataSet(dataset) {
                if (WM.isObject(dataset)) {
                    if (WM.isArray(dataset) && WM.isObject(dataset[0])) {
                        return _.keys(dataset[0]);
                    }
                    return _.keys(dataset);
                }
                return [];
            }

            // to get list of all the columns from the properties-map
            function getColumnsFromPropertiesMap(propertiesMap) {
                if (propertiesMap && propertiesMap.columns) {
                    //populating the column definition in the columns
                    return propertiesMap.columns.map(function (column) {
                        return column.fieldName;
                    });
                }
                return [];
            }

            /* Function to get details of widget the live list is bound to.
             * Example: If live list is bound to the selected items of a grid
             * (binddataset - bind:Widgets.gridId.selecteditem), we first find the
             * variable bound to the grid, get its type and columns, and then generate
             * corresponding bindings for the live list.*/
            function getBoundWidgetDatasetDetails($is) {
                var dataSetParts,
                    refVariable,
                    refVariableName,
                    relFieldName,
                    relFieldType,
                    fields,
                    details,
                    isBoundToSelectedItemSubset = _.includes($is.binddataset, 'selecteditem.');

                dataSetParts    = $is.binddataset.split('.');
                refVariableName = Utils.getVariableName($is);
                refVariable     = getVariable($is, refVariableName);

                relFieldName = isBoundToSelectedItemSubset && dataSetParts[3];

                fields = $rs.dataTypes[refVariable.package].fields;
                details = {
                    'refVariableName': refVariableName,
                    'refVariable': refVariable
                };
                /* If binddataset is of the format: bind:Widgets.widgetName.selecteditem.something,
                 * i.e. widget is bound to a subset of selected item, get type of that subset.*/
                if (relFieldName) {
                    relFieldType = fields[relFieldName].type;
                    details.relFieldType = relFieldType;
                } else {
                    // When binddataset is of the format: bind:Widgets.widgetName.selecteditem
                    details.fields = fields;
                }
                return details;
            }

            //* Fetch column bindings for the live list in case it is bound to a widget.
            function fetchDynamicColumns($is) {
                var fields = [],
                    result;
                result = getBoundWidgetDatasetDetails($is);
                if (result.fields) {
                    fields = result.fields;
                } else if (result.relFieldType) {
                    //Invoke the function to fetch sample data-structure for the field.
                    fields = $servicevariable.getServiceModel({
                        typeRef: result.relFieldType,
                        variable: result.refVariable
                    });
                }
                return WM.isObject(fields) ? _.keys(fields) : fields;
            }

            function updateLiveListBindings($is, forceUpdate) {
                var columns;

                if ($is.dataset && $is.dataset.propertiesMap) {
                    columns = getColumnsFromPropertiesMap($is.dataset.propertiesMap);
                } else {
                    columns = getColumnsFromDataSet($is.dataset);
                }

                if (!columns || !columns.length) {
                    // If live list is bound to a widget, fetch the columns accordingly.
                    if (_.includes($is.binddataset, 'bind:Widgets.')) {
                        columns = fetchDynamicColumns($is);
                    }
                }
                // emit event to modify the liveList template
                $rs.$emit('livelist-template-modified', {
                    'widgetName' : $is.name,
                    'bindDataset': $is.binddataset,
                    'fields'     : columns,
                    'forceUpdate': forceUpdate
                });
            }

            function handlePageSizeDisplay($is, variableObj) {
                if (variableObj) {
                    var isBoundToLiveVariable = (variableObj.category === 'wm.LiveVariable'),
                        isBoundToQueryServiceVariable = (variableObj.category === 'wm.ServiceVariable') && (variableObj.serviceType === 'DataService');
                    // Make the "pageSize" property hidden so that no editing is possible for live and query service variables
                    $is.widgetProps.pagesize.show = !(isBoundToLiveVariable || isBoundToQueryServiceVariable);
                }
            }

            function setFetchInProgress($is, inProgress) {
                $is.$liScope.fetchInProgress = inProgress;
            }


            function bindScrollEvt($is, $el) {
                var $dataNavigator = $el.find('> .panel-footer > [data-identifier=datanavigator]'),
                    navigator      = $dataNavigator.isolateScope(),
                    lastScrollTop  = 0;

                $el.find('> ul')
                    .children()
                    .first()
                    .scrollParent(false)
                    .each(function () {
                        lastScrollTop = this.scrollTop;
                    })
                    .off('scroll.livelist')
                    .on('scroll.livelist', function (evt) {
                        var target = evt.target,
                            clientHeight,
                            totalHeight,
                            scrollTop;

                        target =  target === document ? target.scrollingElement : target;

                        clientHeight = target.clientHeight;
                        totalHeight  = target.scrollHeight;
                        scrollTop    = target.scrollTop;

                        if ((lastScrollTop < scrollTop) && (totalHeight * 0.9 < scrollTop + clientHeight)) {
                            WM.element(this).off('scroll.livelist');
                            $rs.$evalAsync(function () {
                                setFetchInProgress($is, true);
                                navigator.navigatePage('next');
                                if (navigator.isLastPage()) {
                                    setFetchInProgress($is, false);
                                }
                            });
                        }

                        lastScrollTop = scrollTop;
                    });
            }

            // finds the field having the given fieldName and returns the obj
            function getObjfromFieldname(name, data) {
                return _.find(data, function (field) {
                    return field.fieldName ===  name;
                });
            }

            // returns the field type
            function getFieldType(dataProps, groupby) {
                var field = groupby.split('.'),
                    obj;
                _.each(field, function (name, idx) {
                    if (idx === 0) {
                        obj = getObjfromFieldname(name, dataProps.columns);
                    } else {
                        obj = getObjfromFieldname(name, obj.columns);
                    }
                });
                return obj.type;
            }

            // This function adds the li elements if groupby is set.
            function addListElements(_s, $el, $is, attrs, listCtrl) {
                var $liTemplate,
                    groupedLiData,
                    regex    = /[^\w]/g,
                    ALPHABET = 'alphabet',
                    OTHERS = 'Others';

                function groupDataByField(liData) {
                    var concatStr = Utils.findValueOf(liData, $is.groupby);

                    if (WM.isUndefined(concatStr)) {
                        concatStr = OTHERS; // by default set the undefined groupKey as 'others'
                    }

                    // if match prop is alphabetic ,get the starting alphabet of the word as key.
                    if ($is.match === ALPHABET) {
                        return concatStr.substr(0, 1);
                    }

                    return concatStr;
                }

                $el.find('> [data-identifier=list]').empty();

                // groups the fields based on the groupby value.
                if (_.includes($is.groupby, '(')) {
                    var groupDataByUserDefinedFn = _s[$is.groupby.split('(')[0]];
                    groupedLiData = _.groupBy(_s.fieldDefs, groupDataByUserDefinedFn);
                } else {
                    groupedLiData = _.groupBy(_s.fieldDefs, groupDataByField);
                }

                // append data to li based on the grouped data.
                _.each(groupedLiData, function (groupedData, groupkey) {
                    liTemplateWrapper_start  = '';
                    liTemplateWrapper_end    = '></li></ul></li>';
                    liTemplateWrapper_start +=  '<li class="app-list-item-group clearfix"><ul class="list-group" ng-class="listclass"><li class="app-list-item-header list-item"><h4>' + groupkey + '</h4></li>';

                    groupkey = groupkey.replace(regex, '');

                    // appending the sorted data to scope based to groupkey
                    _s['_groupData' + groupkey] = _.sortBy(groupedData, function (data) {
                        return data[$is.groupby];
                    });

                    liTemplateWrapper_start += '<li ng-repeat="item in _groupData' +  groupkey + ' track by $index" tabindex="0" class="app-list-item" ng-class="[itemsPerRowClass, itemclass]" ';

                    $liTemplate = prepareLITemplate(listCtrl.$get('listTemplate'), attrs, true);

                    $el.find('> [data-identifier=list]').append($liTemplate);
                    $compile($liTemplate)($is.$liScope);
                });
            }

            // With given data, creates list items and updates the markup
            function updateFieldDefs($is, $el, data, attrs, listCtrl) {
                var unbindWatcher, _s, fieldDefs;

                _s        = $is.$liScope;
                fieldDefs = _s.fieldDefs;

                if ($is.infScroll) {
                    if (WM.isUndefined(fieldDefs)) {
                        _s.fieldDefs = fieldDefs = [];
                    }

                    if ($is.dataNavigator.isFirstPage()) {
                        _s.fieldDefs.length = 0;
                    }

                    _.forEach(data, function (item) {
                        fieldDefs.push(item);
                    });

                    $rs.$evalAsync(function () {
                        setFetchInProgress($is, false);
                        if (fieldDefs.length) {
                            bindScrollEvt($is, $el);
                        }
                    });
                } else {
                    _s.fieldDefs = data;
                }

                if ($is.orderby && $is.orderby !== '') {
                    _s.fieldDefs = FormWidgetUtils.getOrderedDataSet(_s.fieldDefs, $is.orderby);
                }

                if ($is.groupby && $is.groupby !== '') {
                    addListElements(_s, $el, $is, attrs, listCtrl);
                }

                if (!data.length) {
                    $is.noDataFound = true;
                    $is.selecteditem = undefined;
                }
                // deselect all the selected items on data change.
                $el.find('li.app-list-item.active').removeClass('active');

                // In run mode, making the first element selected, if flag is set
                if ($is.selectfirstitem) {
                    unbindWatcher = $is.$watch(function () {
                        var items = $el.find('.list-group li.app-list-item:first-of-type');
                        if (items.length) {
                            $rs.$safeApply($is, function () {
                                $timeout(function () {
                                    var item = items.first();
                                    // If item has active class already, no need to click again
                                    if (!item.hasClass('active')) {
                                        item.click();
                                    }
                                }, 0, false);
                                unbindWatcher();
                            });
                        }
                    });
                }
            }

            function onDataChange($is, $el, nv, attrs, listCtrl) {
                if (nv) {
                    $is.noDataFound = false;

                    if (nv.data) {
                        nv = nv.data;
                    } else {
                        if (!_.includes($is.binddataset, 'bind:Widgets.')) {
                            var boundVariableName = Utils.getVariableName($is),
                                variable = getVariable($is, boundVariableName);
                            // data from the live list must have .data filed
                            if (variable && variable.category === 'wm.LiveVariable') {
                                return;
                            }
                        }
                    }

                    // If the data is a pageable object, then display the content.
                    if (WM.isObject(nv) && Utils.isPageable(nv)) {
                        nv = nv.content;
                    }

                    if (WM.isObject(nv) && !WM.isArray(nv)) {
                        nv = [nv];
                    }
                    if (!$is.binddataset) {
                        if (WM.isString(nv)) {
                            nv = nv.split(',');
                        }
                    }
                    if (WM.isArray(nv)) {
                        updateFieldDefs($is, $el, nv, attrs, listCtrl);
                    }
                } else {
                    if (CONSTANTS.isRunMode) {
                        updateFieldDefs($is, $el, [], attrs, listCtrl);
                    }
                }
            }

            function setupDataSource($is, $el, nv, attrs, listCtrl) {

                var $dataNavigator, // dataNavigator element
                    dataNavigator,  // dataNavigator scope
                    binddataset;

                if ($is.navControls || $is.infScroll) {

                    _.set($is, '$liScope.fieldDefs', undefined);

                    binddataset = $is.binddataset;
                    Utils.triggerFn($is._watchers.dataset);
                    $is.dataNavigator = undefined;
                    $timeout(function () {
                        $dataNavigator = $el.find('> .panel-footer > [data-identifier=datanavigator]');
                        dataNavigator = $dataNavigator.isolateScope();
                        $is.dataNavigator = dataNavigator;
                        dataNavigator.pagingOptions = {
                            maxResults: $is.pagesize || 20
                        };

                        // remove the existing watchers
                        Utils.triggerFn($is._watchers.dataNavigatorResult);
                        Utils.triggerFn($is._watchers.dataNavigatorMaxResults);

                        // create a watch on dataNavigator.result
                        $is._watchers.dataNavigatorResult = dataNavigator.$watch('result', function (_nv) {
                            onDataChange($is, $el, _nv, attrs, listCtrl);
                        }, true);
                        $is._watchers.dataNavigatorMaxResults = dataNavigator.$watch('maxResults', function (_nv) {
                            $is.pagesize = _nv;
                        }, true);

                        dataNavigator.dataset = binddataset;
                    });
                } else {
                    onDataChange($is, $el, nv, attrs, listCtrl);
                }
            }

            function studioMode_onDataSetChange($is, doNotRemoveTemplate) {
                var boundVariableName = Utils.getVariableName($is),
                    variable = getVariable($is, boundVariableName);
                //Assign variable name and type on widget scope if variable is available.
                if (variable) {
                    $is.variableName = variable.name;
                    $is.variableType = variable.category;
                }
                if ($is.oldbinddataset !== $is.binddataset && $is._isInitialized) {
                    if (!doNotRemoveTemplate) {
                        updateLiveListBindings($is, true);
                    }
                }
                handlePageSizeDisplay($is, variable);
            }

            function runMode_onDataSetChange($is, $el, nv, attrs, listCtrl) {
                if ($is.oldbinddataset !== $is.binddataset) {
                    setupDataSource($is, $el, nv, attrs, listCtrl);
                } else {
                    onDataChange($is, $el, nv, attrs, listCtrl);
                }
            }

            function onDataSetChange($is, $el, doNotRemoveTemplate, nv, attrs, listCtrl) {

                if (CONSTANTS.isStudioMode) {
                    studioMode_onDataSetChange($is, doNotRemoveTemplate);
                } else {
                    runMode_onDataSetChange($is, $el, nv, attrs, listCtrl);
                }

                $is.oldbinddataset = $is.binddataset;
            }

            function resetNavigation($is) {
                $is.navControls = undefined;
                $is.infScroll   = false;
                if ($is.widgetid) {
                    $is.widgetProps.itemsperrow.show = true;
                }
            }

            function enableBasicNavigation($is) {
                $is.navControls = NAVIGATION.BASIC;
            }

            function enableInlineNavigation($is) {

                $is.navControls       = NAVIGATION.INLINE;
                // hides itemsperrow property in studio mode.
                if ($is.widgetid) {
                    $is.widgetProps.itemsperrow.show = false;
                }
            }

            function enableClassicNavigation($is) {
                $is.navControls = NAVIGATION.CLASSIC;
            }

            function enablePagerNavigation($is) {
                $is.navControls = NAVIGATION.PAGER;
            }

            function enableInfiniteScroll($is) {
                $is.infScroll = true;
            }

            function onNavigationTypeChange($is, type) {
                resetNavigation($is);
                switch (type) {
                case NAVIGATION.BASIC:
                    enableBasicNavigation($is);
                    break;
                case NAVIGATION.INLINE:
                    enableInlineNavigation($is);
                    break;
                case NAVIGATION.ADVANCED:
                case NAVIGATION.CLASSIC:
                    enableClassicNavigation($is);
                    break;
                case NAVIGATION.SCROLL:
                    enableInfiniteScroll($is);
                    break;
                case NAVIGATION.PAGER:
                    enablePagerNavigation($is);
                    break;
                }
            }

            function isFieldTypeString(variable, fieldName) {
                return (DeviceVariableService.getFieldType(variable, fieldName) === 'string');
            }

            /* In case of run mode, the field-definitions will be generated from the markup
             * Define the property change handler. This function will be triggered when there is a change in the widget property
             */
            function propertyChangeHandler($is, $el, attrs, listCtrl, key, nv, ov) {
                var doNotRemoveTemplate,
                    selectedVariable,
                    oldClass,
                    newClass,
                    markup,
                    $element,
                    eleScope    = $el.scope(),
                    variable    = Utils.getVariableName($is, eleScope),
                    wp          = $is.widgetProps,
                    stringType  = 'java.lang.String';

                //checking if the height is set on the element then we will enable the overflow
                switch (key) {
                case 'height':
                    if (nv) {
                        $is.overflow = 'auto';
                    }
                    break;
                case 'dataset':
                    doNotRemoveTemplate = attrs.template === 'true';
                    onDataSetChange($is, $el, doNotRemoveTemplate, nv, attrs, listCtrl);

                    selectedVariable = eleScope.Variables[variable];

                    if ($is.widgetid && WM.isDefined(nv) && nv !== null) {
                        // set the groupby options
                        wp.groupby.options = wp.orderby.options = WidgetUtilService.extractDataSetFields(nv, nv.propertiesMap, {'sort' : true});

                        // show the match property
                        if ($is.groupby && $is.groupby !== '' && nv.propertiesMap && !(_.includes($is.groupby, '('))) {
                            wp.match.show = (getFieldType(nv.propertiesMap, $is.groupby) === 'string');
                        }

                        //if studio-mode, then update the displayField & dataField in property panel
                        if (!nv.length) {
                            //Get variable and properties map only on binddataset change
                            if ($is.oldBindDataSet !== $is.binddataset) {
                                if (!WM.isString(nv)) {
                                    if (selectedVariable && selectedVariable.category === 'wm.LiveVariable') {
                                        nv.propertiesMap = selectedVariable.propertiesMap;
                                    }
                                }
                            }
                            if ($is.groupby) {
                                // set the groupby options
                                if (selectedVariable && selectedVariable.category === 'wm.DeviceVariable') {
                                    wp.groupby.options = _.keys(DeviceVariableService.getOperation(selectedVariable.service, selectedVariable.operation).getMeta());
                                    return;
                                }
                                wp.groupby.options = WidgetUtilService.extractDataSetFields(nv.data || nv, nv.propertiesMap, {'sort' : false});
                            }
                        }
                        // show match property for device variables
                        if (selectedVariable && selectedVariable.category === 'wm.DeviceVariable' && $is.groupby && $is.groupby !== '') {
                            wp.match.show = isFieldTypeString(selectedVariable, $is.groupby);
                        }

                        if ($is.groupby !== '') {
                            wp.match.show = false;
                        }

                        if (!wp.match.show) {
                            $is.$root.$emit('set-markup-attr', $is.widgetid, {'match': ''});
                        }

                        // empty option selection is included in groupby options.
                        if (wp.groupby.options) {
                            var groupbyOptions = [{
                                'name'      : 'Javascript',
                                'category'  : 'Script'
                            }];
                            if ($is.groupby && _.includes($is.groupby, '(')) {
                                groupbyOptions.push({
                                    'name'      : $is.groupby,
                                    'category'  : 'Script'
                                });
                            }
                            _.forEach(wp.groupby.options, function (option) {
                                groupbyOptions.push({
                                    'name'      : option,
                                    'category'  : 'Fields'
                                });
                            });
                            wp.groupby.options = groupbyOptions;
                        }
                    }
                    break;
                case 'itemsperrow':
                    if (CONSTANTS.isStudioMode) {
                        oldClass = ov && 'col-md-' + 12 / (+ov);
                        newClass = nv && 'col-md-' + 12 / (+nv);
                        $el.find('.app-listtemplate').removeClass(oldClass).addClass(newClass);
                    }
                    break;
                case 'navigation':
                    if (nv === 'Advanced') { //Support for older projects where navigation type was advanced instead of clasic
                        $is.navigation = 'Classic';
                        return;
                    }
                    if (CONSTANTS.isStudioMode) {
                        wp.showrecordcount.show = !_.includes(['Pager', 'Inline', 'Scroll', 'None'], nv);
                        onNavigationTypeChange($is, nv);
                    }
                    break;
                case 'groupby':
                    selectedVariable = eleScope.Variables[variable];
                    if ($is.widgetid) {
                        if (nv === '') {
                            wp.match.show = false;
                        } else if ($is.dataset && $is.groupby !== 'Javascript' && !_.includes($is.groupby, '(')) {
                            if (selectedVariable.category === 'wm.ServiceVariable' || selectedVariable.category === 'wm.Variable') {
                                wp.match.show = _.get($rs, ['dataTypes', selectedVariable.type, 'fields', $is.groupby, 'type'], stringType) === stringType;
                            } else if (selectedVariable && selectedVariable.category === 'wm.DeviceVariable') {
                                wp.match.show = isFieldTypeString(selectedVariable, $is.groupby);
                            } else {
                                wp.match.show = (getFieldType($is.dataset.propertiesMap, $is.groupby) === 'string');
                            }
                        }
                        // enablereorder is not shown with groupby
                        if (nv && nv !== '') {
                            markup   = Utils.getService('MarkupManagerService').getMarkup();
                            $element = markup.find('[name=' + attrs.name + ']');
                            $element.removeAttr('enablereorder');
                            $is.enablereorder     = false;
                            wp.enablereorder.show = false;
                            if (nv === 'Javascript') {
                                wp.groupby.isGroupBy = true;
                            } else {
                                wp.groupby.isGroupBy = false;
                            }
                        } else {
                            wp.enablereorder.show = true;
                        }
                        if (!wp.match.show) {
                            $is.$root.$emit('set-markup-attr', $is.widgetid, {'match': ''});
                        }
                    }
                    break;
                }
            }

            function defineProps($is, $el) {
                /*This is to make the "Variables" & "Widgets" available in the Data-navigator it gets compiled with the live-list isolate Scope
                 * and "Variables", "Widgets" will not be available in that scope.
                 * element.scope() might refer to the controller scope/parent scope.*/
                var _scope = $el.scope(); // scope inherited from controller's scope

                Object.defineProperties($is, {
                    'Variables': {
                        'get': function () {
                            return _scope.Variables;
                        }
                    },
                    'Widgets': {
                        'get': function () {
                            return _scope.Widgets;
                        }
                    }
                });
            }

            function createChildScope($is, $el, attrs) {
                var _scope = $el.scope(), // scop which inherits controller's scope
                    $liScope = _scope.$new(); // create a new child scope. List Items will be compiled with this scope.

                // evt handlers will be created by isolateScope. redefine them on $liScope.
                WM.extend($liScope, {
                    'onClick'          : $is.onClick,
                    'onDblclick'       : $is.onDblclick,
                    'onTap'            : $is.onTap,
                    'onDoubletap'      : $is.onDoubletap,
                    'onMouseenter'     : $is.onMouseenter,
                    'onMouseleave'     : $is.onMouseleave,
                    'onEnterkeypress'  : $is.onEnterkeypress,
                    'onSetrecord'      : $is.onSetrecord,
                    'itemclass'        : $is.itemclass,
                    'itemsPerRowClass' : getRowClass(attrs.itemsperrow),
                    'addRow'           : $is.addRow,
                    'updateRow'        : $is.updateRow,
                    'deleteRow'        : $is.deleteRow
                });

                return $liScope;
            }

            function applyWrapper($tmplContent, attrs, flag) {
                var tmpl = liTemplateWrapper_start;

                if (attrs.hasOwnProperty('onMouseenter')) {
                    tmpl += ' ng-mouseenter="onMouseenter({$event: $event, $scope: this})" ';
                }

                if (attrs.hasOwnProperty('onMouseleave')) {
                    tmpl += ' ng-mouseleave="onMouseleave({$event: $event, $scope: this})" ';
                }

                tmpl += liTemplateWrapper_end;
                tmpl = WM.element(tmpl);

                if (flag) {
                    tmpl.find('.app-list-item').append($tmplContent);
                } else {
                    tmpl.first().append($tmplContent);
                }
                return tmpl;
            }

            function prepareLITemplate(tmpl, attrs, flag) {
                var $tmpl = WM.element(tmpl),
                    $div  = WM.element('<div></div>').append($tmpl),
                    parentDataSet = attrs.dataset || attrs.scopedataset;

                if (parentDataSet) {
                    Utils.updateTmplAttrs($div, parentDataSet);
                }
                $tmpl = applyWrapper($tmpl, attrs, flag);

                return $tmpl;
            }
            /*Function to get data of all active elements*/
            function getSelectedItems($el, items) {
                items.length = 0;
                $el.find('li.app-list-item.active').each(function () {
                    var liScope = WM.element(this).scope();
                    items.push(liScope.item);
                });
                return items;
            }
            // Triggers event to update or delete list item
            function triggerWMEvent($is, evt, name) {
                var $li = WM.element(evt.target).parents('li.app-list-item');
                if (!_.isEmpty($li)) {
                    $is.selecteditem = $li.scope().item;
                }
                $rs.$safeApply($is);
                $rs.$emit('wm-event', $is.name, name);
            }

            function checkSelectionLimit($is, count) {
                return (!$is.selectionlimit || count < $is.selectionlimit);
            }

            function setupEvtHandlers($is, $el, attrs) {
                var pressStartTimeStamp = 0,
                    $hammerEl = new Hammer($el[0], {}),
                    selectCount = 0,
                    isMultiSelect = false;// Setting to true on first long press

                // listen on to the click event for the ul element & get li clicked of the live-list
                $el.on('click.wmActive', 'ul.app-livelist-container', function (evt) {
                    // returning if click event is triggered within 50ms after pressup event occurred
                    if (pressStartTimeStamp + 50 > Date.now() || WM.element(evt.target).is('input')) {
                        return;
                    }
                    evt.stopPropagation();
                    var $li = WM.element(evt.target).closest('li.app-list-item'),
                        $liScope = $li && $li.scope(),
                        isActive = $li.hasClass('active'),
                        first,
                        last,
                        $liItems;

                    $is.firstSelectedItem = $is.firstSelectedItem || $li;
                    // Setting selectCount value based number of items selected.
                    selectCount = WM.isArray($is.selecteditem) ? $is.selecteditem.length : (WM.isObject($is.selecteditem) ? 1 : 0);
                    if ($liScope) {
                        if (isMultiSelect && $rs.isMobileApplicationType) {
                            if (checkSelectionLimit($is, selectCount) || $li.hasClass('active')) {
                                $li.toggleClass('active');
                                isMultiSelect = selectCount !== 0;//Setting 'isMultiSelect' to false if no items are selected
                            } else {
                                Utils.triggerFn($is.onSelectionlimitexceed, {$event: evt, $scope: $is});
                            }
                        } else if (evt.ctrlKey || evt.metaKey) {
                            if (checkSelectionLimit($is, selectCount) || $li.hasClass('active')) {
                                $is.lastSelectedItem = $is.firstSelectedItem = $li;
                                $li.toggleClass('active');
                            } else {
                                Utils.triggerFn($is.onSelectionlimitexceed, {$event: evt, $scope: $is});
                            }
                        } else if (evt.shiftKey) {
                            $liItems = $el.find('li.app-list-item');
                            first    = $liItems.index($li);
                            last     = $liItems.index($is.firstSelectedItem);

                            // if first is greater than last, then swap values
                            if (first > last) {
                                last = [first, first = last][0];
                            }
                            if (checkSelectionLimit($is, last - first)) {
                                $el.find('li.app-list-item.active').removeClass('active');
                                _.forEach($liItems, function (element, index) {
                                    if (index >= first && index <= last) {
                                        WM.element($liItems[index]).addClass('active');
                                    }
                                });
                                $is.lastSelectedItem = $li;
                            } else {
                                Utils.triggerFn($is.onSelectionlimitexceed, {$event: evt, $scope: $is});
                            }
                        } else {
                            if (!isActive || selectCount > 1) {
                                $el.find('li.app-list-item.active').removeClass('active'); // removing active class from previous selectedItem
                                $li.addClass('active');
                                $is.lastSelectedItem = $is.firstSelectedItem = $li;
                            }
                            // trigger $apply, as 'click' or 'tap' is out of angular-scope
                            if (attrs.onClick) {
                                Utils.triggerFn($liScope.onClick, {$event: evt, $scope: $liScope});
                            }
                            if (attrs.onTap) {
                                Utils.triggerFn($liScope.onTap, {$event: evt, $scope: $liScope});
                            }
                        }
                    }
                    $rs.$safeApply($is);
                });

                $el.on('keydown', 'li.app-list-item', function (evt) {
                    var $liItems,
                        presentIndex,
                        firstIndex,
                        keyPressed;

                    function setIndexValues() {
                        $liItems     = $el.find('li.app-list-item');
                        presentIndex = $liItems.index($is.lastSelectedItem);
                        firstIndex   = $liItems.index($is.firstSelectedItem);
                        selectCount = WM.isArray($is.selecteditem) ? $is.selecteditem.length : (WM.isObject($is.selecteditem) ? 1 : 0);
                    }

                    keyPressed = Utils.getActionFromKey(evt);
                    if (keyPressed === 'SHIFT+UP' || keyPressed === 'SHIFT+LEFT') {
                        setIndexValues();
                        if (presentIndex > 0) {
                            if ((presentIndex === firstIndex || presentIndex < firstIndex) && checkSelectionLimit($is, selectCount)) {
                                $is.lastSelectedItem = WM.element($liItems[presentIndex - 1]).toggleClass('active');
                            } else if (presentIndex > firstIndex) {
                                WM.element($liItems[presentIndex]).toggleClass('active');
                                $is.lastSelectedItem = WM.element($liItems[presentIndex - 1]);
                            } else {
                                Utils.triggerFn($is.onSelectionlimitexceed, {$event: evt, $scope: $is});
                            }
                        }
                        $is.lastSelectedItem.focus();
                        $rs.$safeApply($is);
                    } else if (keyPressed === 'SHIFT+RIGHT' || keyPressed === 'SHIFT+DOWN') {
                        setIndexValues();
                        if (presentIndex < $liItems.length - 1) {
                            if ((presentIndex === firstIndex || presentIndex > firstIndex) && checkSelectionLimit($is, selectCount)) {
                                $is.lastSelectedItem = WM.element($liItems[presentIndex + 1]).toggleClass('active');
                            } else if (presentIndex < firstIndex) {
                                WM.element($liItems[presentIndex]).toggleClass('active');
                                $is.lastSelectedItem = WM.element($liItems[presentIndex + 1]);
                            } else {
                                Utils.triggerFn($is.onSelectionlimitexceed, {$event: evt, $scope: $is});
                            }
                        }
                        $is.lastSelectedItem.focus();
                        $rs.$safeApply($is);
                    }
                });

                // listen on to the dblclick event for the ul element & get li dblclicked of the live-list
                $el.on('dblclick.wmActive', 'ul', function (evt) {
                    var $li = WM.element(evt.target).closest('li.app-list-item'),
                        $liScope = $li && $li.scope();

                    // trigger $apply, as 'dblclick' or 'doubleTap' is out of angular-scope
                    if (attrs.onDblclick) {
                        Utils.triggerFn($liScope.onDblclick, {$event: evt, $scope: $liScope});
                    }
                    if (attrs.onDoubletap) {
                        Utils.triggerFn($liScope.onDoubletap, {$event: evt, $scope: $liScope});
                    }
                    $rs.$safeApply($is);
                });

                $hammerEl.on('pressup', function (evt) {
                    if (!isMultiSelect && $rs.isMobileApplicationType) {
                        var $li = WM.element(evt.target).closest('li.app-list-item');
                        $el.find('li.app-list-item.active').removeClass('active'); // removing active class from previous selectedItem
                        $li.addClass('active'); // adding active class to current selectedItem
                        isMultiSelect = true;
                        $rs.$safeApply($is);
                        pressStartTimeStamp = Date.now();//Recording pressup event's timestamp
                    }
                });
                //Triggered on click of edit action
                $el.on('click', '[class*="edit-list-item"]', function (evt) {
                    triggerWMEvent($is, evt, 'update');
                });
                //Triggered on click of delete action
                $el.on('click', '[class*="delete-list-item"]', function (evt) {
                    triggerWMEvent($is, evt, 'delete');
                });
            }

            function preLinkFn($is, $el, attrs) {
                if (CONSTANTS.isStudioMode) {
                    $is.widgetProps = Utils.getClonedObject(widgetProps);
                } else {
                    $is.widgetProps = widgetProps;
                }

                // initialising oldDataSet to -1, so as to handle live-list with variable binding with live variables, during page 'switches' or 'refreshes'
                $is.oldbinddataset = CONSTANTS.isStudioMode ? attrs.dataset : undefined;
                $is.dataset     = [];   // The data that is bound to the list. Stores the name for reference.
                $is.fieldDefs   = []; // The data required by the wmListItem directive to populate the items
                $is.noDataFound = false;
                Object.defineProperty($is, 'selecteditem', {
                    configurable: true
                });
                defineProps($is, $el);
            }

            function configureDnD($el, $is) {
                var data;
                $el.find('.app-livelist-container').sortable({
                    'appendTo'    : 'body',
                    'containment' : $el.find('.app-livelist-container'),
                    'delay'       : 100,
                    'opacity'     : 0.8,
                    'helper'      : 'clone',
                    'z-index'     : 100,
                    'tolerance'   : 'pointer',
                    'start'       : function (evt, ui) {
                        ui.placeholder.height(ui.item.height());
                        WM.element(this).data('oldIndex', ui.item.index());
                    },
                    'update'      : function (evt, ui) {
                        var newIndex,
                            oldIndex,
                            draggedItem,
                            $dragEl;

                        data        = data || Utils.getClonedObject($is.$liScope.fieldDefs);
                        $dragEl     = WM.element(this);
                        newIndex    = ui.item.index();
                        oldIndex    = $dragEl.data('oldIndex');
                        draggedItem = _.pullAt(data, oldIndex)[0];

                        data.splice(newIndex, 0, draggedItem);
                        Utils.triggerFn($is.onReorder, {$event: evt, $data: data });
                        $dragEl.removeData('oldIndex');
                    }
                });
                $el.find('.app-livelist-container').droppable({'accept': '.app-list-item'});
            }

            function defineSelectedItemProp($is, $el, items) {
                Object.defineProperty($is, 'selecteditem', {
                    get: function () {
                        //update the items with out changing the reference.
                        items = getSelectedItems($el, items);
                        if (items && items.length === 1) {
                            return items[0];
                        }
                        return items;
                    },
                    set: function (items) {
                        $el.find('li.app-list-item.active').removeClass('active'); // removing active class from previous selectedItem
                        if (_.isArray(items)) {
                            _.forEach(items, function (item) {
                                $is.selectItem(item);
                            });
                        } else {
                            $is.selectItem(items);
                        }
                    }
                });
            }
            //Based on the given item, find the index of the list item
            function getItemIndex(listItems, item) {
                var matchIndex;
                listItems.each(function (index) {
                    var $li = WM.element(this),
                        liScope = $li.scope();
                    if (_.isEqual(liScope.item, item)) {
                        matchIndex = index;
                        return false;
                    }
                });
                return matchIndex;
            }
            // Select or delselect the live list item
            function toggleSelectedItem($el, item, isSelect) {
                var listItems = $el.find('.list-group li.app-list-item'),
                    itemIndex = WM.isNumber(item) ? item : getItemIndex(listItems, item),
                    $li = WM.element(listItems[itemIndex]);
                if (isSelect) {
                    $li.addClass('active');
                } else {
                    $li.removeClass('active');
                }
            }

            function postLinkFn($is, $el, attrs, listCtrl) {
                var $liScope,
                    $liTemplate;

                $liScope = createChildScope($is, $el, attrs);
                $is.$liScope = $liScope;

                if (CONSTANTS.isRunMode) {
                    if (!$is.groupby) {
                        liTemplateWrapper_start = '<li ng-repeat="item in fieldDefs track by $index" tabindex="0" class="app-list-item" ng-class="[itemsPerRowClass, itemclass]" ';
                        liTemplateWrapper_end   = '></li><li ng-show="fetchInProgress"><i class="fa fa-spinner fa-spin"></i> loading...</li>';
                        $liTemplate             = prepareLITemplate(listCtrl.$get('listTemplate'), attrs);

                        $el.find('> [data-identifier=list]').append($liTemplate);
                        $el.find('> [data-identifier=list]').addClass('list-group');
                        $compile($liTemplate)($liScope);
                    }

                    if ($is.enablereorder) {
                        configureDnD($el, $is);
                    }

                    $is.$watch('binddataset', function (newVal) {
                        if (_.includes(newVal, 'selecteditem.')) {
                            LiveWidgetUtils.fetchDynamicData($is, function(data){
                                onDataSetChange($is, $el, undefined, data, attrs, listCtrl);
                            });
                        }
                    });
                    setupEvtHandlers($is, $el, attrs);
                }

                WidgetUtilService.registerPropertyChangeListener(propertyChangeHandler.bind(undefined, $is, $el, attrs, listCtrl), $is, notifyFor);

                defineSelectedItemProp($is, $el, []);
                // Select the given item
                $is.selectItem = function (item) {
                    toggleSelectedItem($el, item, true);
                };
                // deselect the given item
                $is.deselectItem = function (item) {
                    toggleSelectedItem($el, item, false);
                };

                // in the run mode navigation can not be changed dynamically
                // process the navigation type before the dataset is set.
                if (attrs.hasOwnProperty('shownavigation') && (attrs.shownavigation === 'true')) {
                    // for legacy applications
                    $is.navigation = NAVIGATION.BASIC;
                }
                onNavigationTypeChange($is, $is.navigation);

                WidgetUtilService.postWidgetCreate($is, $el, attrs);

                if (!attrs.widgetid && attrs.scopedataset) {
                    $is.$watch('scopedataset', function (nv) {
                        if (nv && !$is.dataset) {
                            updateFieldDefs($is, $el, nv);
                        }
                    }, true);
                }
            }

            function compileFn($tEl, tAttrs) {
                /* in run mode there is separate controller for live-list widget but not in studio mode,
                 * to prevent errors in studio mode create and empty function
                 * with particular controller name */
                if (CONSTANTS.isStudioMode) {
                    window[tAttrs.name + 'Controller'] = WM.noop;
                }

                return {
                    'pre' : preLinkFn,
                    'post': postLinkFn
                };
            }

            directiveDefn = {
                'restrict'  : 'E',
                'replace'   : true,
                'transclude': true,
                'scope'     : {},
                'template'  : $tc.get('template/widget/list.html'),
                'compile'   : compileFn
            };

            if (CONSTANTS.isRunMode) {
                directiveDefn.controller = 'listController';
                directiveDefn.scope = {
                    'scopedataset'          : '=?',
                    'onClick'               : '&',
                    'onDblclick'            : '&',
                    'onMouseenter'          : '&',
                    'onMouseleave'          : '&',
                    'onEnterkeypress'       : '&',
                    'onSetrecord'           : '&',
                    'onTap'                 : '&',
                    'onDoubletap'           : '&',
                    'onSelectionlimitexceed': '&'
                };
            }

            return directiveDefn;
        }
    ]);

/**
 * @ngdoc directive
 * @name wm.widgets.live.directive:wmLivelist
 * @restrict E
 *
 * @description
 * The `wmLivelist` directive defines a Live list widget. <br>
 *
 * @requires PropertiesFactory
 * @requires $templateCache
 * @requires WidgetUtilService
 * @requires $compile
 * @requires CONSTANTS
 * @requires Utils
 * @requires $compile
 *
 * @param {string=} name
 *                  Name of the list container.
 * @param {string=} width
 *                  Width of the list container.
 * @param {string=} height
 *                  Height of the list container.
 * @param {string=} itemsperrow
 *                  This property controls the number of widgets displayed within this widget container for a horizontal layout. <br>
 *                  Possible values are `1`, `2`, `3`, `4`, `6`, and `12`. <br>
 *                  default value: `1`.
 * @param {string=} dataset
 *                  Sets the data for the list.<br>
 *                  This is a bindable property.<br>
 *                  When bound to a variable, the data associated with the variable is displayed in the list.
 * @param {object=} scopedataset
 *                  Populate data for the list which is defined in the script<br>
 *                  The data is visible only in the run mode.<br>
 * @param {boolean=} show
 *                  This is a bindable property. <br>
 *                  This property will be used to show/hide the list on the web page. <br>
 *                  default value: `true`.
 * @param {boolean=} selectfirstitem
 *                  This is a bindable property. <br>
 *                  When the value is true, the first item of the list is selected by default. <br>
 *                  default value: `false`.
 * @param {number=} pagesize
 *                  This property sets the number of items to show in the drop-down list.
 * @param {string=} navigation
 *                  Possible values are `None`, `Classic`, `Scroll`. <br>
 *                  Navigation controls will be displayed based on the selected value.
 * @param {string=} on-click
 *                  Callback function which will be triggered when the widget is clicked.
 * @param {string=} on-dbclick
 *                  Callback function which will be triggered when the widget is double-clicked.
 * @param {string=} on-mouseenter.
 *                  Callback function which will be triggered when the mouse enters the widget.
 * @param {string=} on-mouseleave
 *                  Callback function which will be triggered when the mouse leaves the widget.
 * @param {string=} on-enterkeypress
 *                  Callback function which will be triggered when the user hits ENTER/Return while focus is in this editor.
 * @param {string=} on-setrecord
 *                  Callback function which will be triggered when the record is set using the data-navigator.
 * @example
    <example module="wmCore">
        <file name="index.html">
            <div data-ng-controller="Ctrl" class="wm-app">
               <div>Selected Element: {{selectedItem}}</div>
               <wm-livelist
                   name="{{caption}}"
                   width="{{width}}"
                   height="{{height}}"
                   show="true"
                   scopedataset="dataset"
                   on-click="f($event)">
                    <wm-listtemplate layout="inline">
                        <wm-button class="btn btn-primary" caption="{{item}}"></wm-button>
                    </wm-listtemplate>
               </wm-livelist><br>
                <wm-composite>
                    <wm-label caption="caption:"></wm-label>
                    <wm-text scopedatavalue="caption"></wm-text>
                </wm-composite>
                <wm-composite>
                    <wm-label caption="width:"></wm-label>
                    <wm-text scopedatavalue="width"></wm-text>
                </wm-composite>
                <wm-composite>
                    <wm-label caption="height:"></wm-label>
                    <wm-text scopedatavalue="height"></wm-text>
                </wm-composite>
                <wm-composite>
                    <wm-label caption="dataset:"></wm-label>
                    <wm-text
                       on-blur="blur($event, $scope)"
                       scopedatavalue="dataStr">
                    </wm-text>
                </wm-composite>
            </div>
        </file>
         <file name="script.js">
           function Ctrl($scope) {
               $scope.width = "400px";
               $scope.height= "200px";
               $scope.caption = " Users ";

               $scope.dataset =
               $scope.dataStr = ["user", "admin", "superuser"];

               $scope.f = function (event) {
                   $scope.selectedItem = event.target.innerText;
               };
               $scope.blur = function (event, scope) {
                   $scope.dataset = [];
                   $scope.dataset = scope.datavalue.split(',');
               }
            }
        </file>
    </example>
 */
