/*global WM, window */

WM.module('wm.widgets.live')
    .run(["$templateCache", '$rootScope', function ($templateCache, $rootScope) {
        "use strict";

        $templateCache.put("template/widget/livefilter/livefilter.html",
            '<div data-identifier="livefilter" class="app-livefilter clearfix" init-widget title="{{hint}}" data-ng-show="show" ' +
                $rootScope.getWidgetStyles() +
                '><div data-identifier="filter-elements" ng-transclude></div>' +
                '<div class="basic-btn-grp form-action clearfix app-button-group" style="text-align: right;"></div>' +
                '</div>'
            );
    }]).directive('wmLivefilter', ['PropertiesFactory',
        '$rootScope',
        '$templateCache',
        'WidgetUtilService',
        '$compile',
        'CONSTANTS',
        'QueryBuilder',
        'Variables',
        '$filter',
        'Utils',
        function (PropertiesFactory, $rootScope, $templateCache, WidgetUtilService, $compile, CONSTANTS, QueryBuilder, Variables, $filter, Utils) {
            "use strict";
            var widgetProps = PropertiesFactory.getPropertiesOf("wm.livefilter", ["wm.layouts", "wm.containers"]),
                filterMarkup = '',
                notifyFor = {
                    'dataset': true,
                    'layout': true
                };

            return {
                restrict: 'E',
                replace: true,
                transclude: true,
                scope: {},
                controller: function ($scope) {
                    $scope.__compileWithIScope = true;
                    $scope.clearFilter = function () {
                        WM.forEach($scope.filterFields, function (filterField) {
                            //Added check for range field
                            if (filterField.isRange) {
                                filterField.minValue = '';
                                filterField.maxValue = '';
                            } else {
                                if (filterField.selected) {
                                    filterField.selected = '';
                                }
                                if (filterField.value) {
                                    filterField.value = '';
                                }
                            }
                        });
                        /*Setting result to the default data*/
                        $scope.filter();
                    };
                    $scope.filter = function () {
                        var filterFields = [],
                            query,
                            booleanValue,
                            colName = '';
                        WM.forEach($scope.filterFields, function (filterField) {
                            /* if field is part of a related entity, column name will be 'entity.fieldName' */
                            if (filterField.isRelated) {
                                colName = filterField.field + '.' + filterField.lookupField
                            } else {
                                colName = filterField.field;
                            }

                            if (filterField.isRange) {
                                if (filterField.widget === "date") {
                                    filterField.minValue = $filter('date')(filterField.minValue, 'yyyy-MM-dd');
                                    filterField.maxValue = $filter('date')(filterField.maxValue, 'yyyy-MM-dd');
                                }
                                if (filterField.minValue && filterField.maxValue) {
                                    filterFields.push({
                                        clause: "('" + filterField.minValue + "'<=" + filterField.field + " AND " + filterField.field + "<='" + filterField.maxValue + "')"
                                    });
                                } else if (filterField.minValue) {
                                    filterFields.push({
                                        clause: "('" + filterField.minValue + "'<=" + filterField.field + ")"
                                    });
                                } else if (filterField.maxValue) {
                                    filterFields.push({
                                        clause: "(" + filterField.field + "<='" + filterField.maxValue + "')"
                                    });
                                }
                            } else {
                                switch (filterField.widget) {
                                case 'select':
                                case 'radioset':
                                    if (filterField.selected) {
                                        filterFields.push({
                                            column: colName,
                                            value: filterField.selected
                                        });
                                    }
                                    break;
                                case 'checkboxset':
                                    if (filterField.selected && filterField.selected.length) {
                                        filterFields.push({
                                            column: colName,
                                            value: filterField.selected
                                        });
                                    }
                                    break;
                                case 'date':
                                    if (filterField.value) {
                                        filterFields.push({
                                            column: colName,
                                            value: $filter('date')(filterField.value, 'yyyy-MM-dd')
                                        });
                                    }
                                    break;
                                case 'checkbox':
                                    if (WM.isDefined(filterField.value) && !WM.isString(filterField.value)) {
                                        booleanValue = filterField.value ? 1 : 0;
                                        filterFields.push({
                                            column: colName,
                                            value: booleanValue
                                        });
                                    }
                                    break;
                                default:
                                    if (filterField.value) {
                                        filterFields.push({
                                            column: colName,
                                            value: filterField.value
                                        });
                                    }
                                    break;
                                }
                            }
                        });

                        query = QueryBuilder.getQuery({
                            "tableName": $scope.result.propertiesMap.entityName,
                            "filterFields": filterFields
                        });

                        QueryBuilder.executeQuery({
                            "databaseName": Variables.getVariableByName($scope.variableName, $scope.filterElement.scope()).liveSource,
                            "query": query,
                            "page": 1,
                            "size": 500,
                            "nativeSql": false
                        }, function (data) {
                            var tempObj = {};
                            /*Set the response in "result" so that all widgets bound to "result" of the live-filter are updated.*/
                            $scope.result.data = data.content;
                            /*Create an object as required by the filterFields for live-variable so that all further calls to getData take place properly.
                            * This is used by widgets such as dataNavigator.*/
                            WM.forEach(filterFields, function (filterField) {
                                tempObj[filterField.column] = {};
                                tempObj[filterField.column]['value'] = filterField.value;
                            });
                            $scope.result.filterFields = tempObj;
                            /*Set the paging options also in the result so that it could be used by the dataNavigator.
                            * "currentPage" is set to "1" because each time the filter is applied, the dataNavigator should display results from the 1st page.*/
                            $scope.result.pagingOptions = {
                                "dataSize": data.totalElements,
                                "maxResults": Variables.getVariableByName($scope.variableName, $scope.filterElement.scope()).maxResults || 20,
                                "currentPage": 1
                            };
                        });
                    };
                    $scope.constructDefaultData = function (dataset) {
                        var columnObj = dataset.propertiesMap.columns,
                            colDef,
                            colDefArray = [],
                            column,
                            numColumns = Math.min(columnObj.length, 5),
                            index,
                            getWidgetType = function (type) {
                                var widgetType;
                                switch (type) {
                                case "date":
                                    widgetType = "date";
                                    break;
                                case "boolean":
                                    widgetType = "checkbox";
                                    break;
                                default:
                                    widgetType = "text";
                                    break;
                                }
                                return widgetType;
                            };
                        for (index = 0; index < numColumns; index++) {
                            column = columnObj[index];
                            colDef = {};
                            colDef.field = column.fieldName;
                            colDef.displayName = Utils.prettifyLabel(column.fieldName);
                            colDef.widget = getWidgetType(column.type);
                            colDef.isRange = false;
                            colDef.filterOn = column.fieldName;
                            colDef.lookupType = '';
                            colDef.lookupField = '';
                            colDef.minPlaceholder = '';
                            colDef.maxPlaceholder = '';
                            colDef.datepattern = '';
                            colDef.multiple = '';
                            colDef.value = '';
                            colDef.type = column.type;
                            colDef.isPrimaryKey = column.isPrimaryKey;
                            colDef.generator = column.generator;
                            colDef.show = true;
                            if (column.isRelated) {
                                /* otherwise build object with required configuration */
                                colDef.field = column.fieldName.charAt(0).toLowerCase() + column.fieldName.slice(1);
                                colDef.displayName = colDef.field;
                                colDef.isRelated = true;
                                colDef.lookupType = column.relatedEntityName;
                                colDef.lookupField = '';
                                WM.forEach(column.columns, function (subcolumn) {
                                    if (subcolumn.isPrimaryKey) {
                                        colDef.lookupField = subcolumn.fieldName;
                                    }
                                });
                                colDef.relatedEntityName = column.relatedEntityName;
                            } else {
                                colDef.isRelated = false;
                            }
                            colDefArray.push(colDef);
                        }

                        return colDefArray;
                    };
                    /*Calls the filter function if default values are present*/
                    $scope.filterOnDefault = function () {
                        /*Check if default value is present for any filter field*/
                        var defaultObj = _.find($scope.filterFields, function (obj) {
                            return obj.value;
                        });
                        /*If default value exists and data is loaded, apply the filter*/
                        if (defaultObj && $scope.result) {
                            $scope.filter();
                        }
                    };
                },
                template: function (element) {
                    filterMarkup = element.html();
                    return $templateCache.get("template/widget/livefilter/livefilter.html");
                },
                compile: function (tElement, tAttr) {
                    tAttr.gridColumnMarkup = filterMarkup;

                    return {
                        pre: function (scope, element) {
                            scope.widgetProps = WM.copy(widgetProps);
                            scope.filterElement = element;
                            scope.Variables = element.scope().Variables;
                            scope.Widgets = element.scope().Widgets;
                        },
                        post: function (scope, element, attrs) {
                            var variableRegex = /^bind:Variables\.(.*)\.dataSet$/,
                                handlers = [],
                                layoutObj = {
                                    'One Column': 1,
                                    'Two Column': 2,
                                    'Three Column': 3,
                                    'Four Column': 4
                                },
                                defaultButtonsArray = [
                                    {
                                        key : 'filter',
                                        class: 'btn-primary',
                                        iconname: 'filter',
                                        action: 'filter()',
                                        displayName: 'filter',
                                        show: true,
                                        type: 'button'
                                    },
                                    {
                                        key : 'clear',
                                        class: 'btn',
                                        iconname: 'clear',
                                        action: 'clearFilter()',
                                        displayName: 'clear',
                                        show: true,
                                        type: 'button'
                                    }];
                            scope.filterContainer = element;
                            scope.primaryKey = null;
                            scope.buttonArray = scope.buttonArray || defaultButtonsArray;

                            scope.getActiveLayout = function () {
                                return layoutObj[scope.layout] || 1;
                            };

                            function updateAllowedValues() {
                                WM.forEach(scope.filterFields, function (filterField) {
                                    var query, tableName, columns;
                                    if (filterField.widget === 'select' || filterField.widget === 'radioset' || filterField.widget === 'checkboxset') {
                                        if (filterField.isRelated) {
                                            tableName = filterField.lookupType;
                                            columns = filterField.lookupField;
                                            query = QueryBuilder.getQuery({
                                                "tableName": tableName,
                                                "columns": [" DISTINCT " + columns + " AS " + columns]
                                            });
                                            filterField.datafield = columns;
                                            filterField.displayfield = columns;
                                        } else {
                                            query = QueryBuilder.getQuery({
                                                "tableName": scope.result.propertiesMap.entityName,
                                                "columns": [" DISTINCT " + filterField.field + " AS " + filterField.field]
                                            });
                                            filterField.datafield = filterField.field;
                                            filterField.displayfield = filterField.field;
                                        }
                                        QueryBuilder.executeQuery({
                                            "databaseName": Variables.getVariableByName(scope.variableName, element.scope()).liveSource,
                                            "query": query,
                                            "page": 1,
                                            "size": 500,
                                            "nativeSql": false
                                        }, function (data) {
                                            filterField.dataset = data.content;
                                        });
                                    }
                                });
                            }

                            /* Define the property change handler. This function will be triggered when there is a change in the widget property */
                            function propertyChangeHandler(key, newVal, oldVal) {
                                switch (key) {
                                case "dataset":
                                    var fieldsObj,
                                        buttonsObj,
                                        designerObj;
                                    /*If properties map is populated and if columns are presented for filter construction*/
                                    if (newVal.propertiesMap && WM.isArray(newVal.propertiesMap.columns)) {
                                        /*Check if propertiesMap in oldVal is defined, then it is not equal to newVal propertiesMap*/
                                        if (!oldVal || !oldVal.propertiesMap || !WM.equals(newVal.propertiesMap.columns, oldVal.propertiesMap.columns) || !WM.equals(newVal.data, oldVal.data)) {
                                            scope.variableName = scope.binddataset.match(variableRegex)[1];
                                            scope.result = newVal;
                                            /*Set the "variableName" along with the result so that the variable could be used by the data navigator during navigation.*/
                                            scope.result.variableName = scope.variableName;
                                            /*transform the data to filter consumable data*/
                                            fieldsObj = scope.constructDefaultData(newVal);
                                            buttonsObj = defaultButtonsArray;

                                            /* call method to update allowed values for select type filter fields */
                                            updateAllowedValues();

                                            /*In run mode, on load check if default value exists and apply filter*/
                                            if (CONSTANTS.isRunMode) {
                                                scope.filterOnDefault();
                                            }
                                        }
                                    } else if (!newVal && CONSTANTS.isStudioMode) { /*Clear the variables when the live-filter has not been bound.*/
                                        //element.empty();
                                        scope.variableName = '';
                                        scope.result = '';
                                        scope.filterFields = '';
                                        scope.filterConstructed = false;
                                        scope.fieldObjectCreated = false;
                                        fieldsObj = [];
                                        buttonsObj = [];
                                    }
                                    if (CONSTANTS.isStudioMode && scope.newcolumns && fieldsObj) {
                                        designerObj = {
                                            widgetName: scope.name,
                                            fieldDefs: fieldsObj,
                                            buttonDefs: buttonsObj,
                                            variableName: scope.variableName,
                                            scopeId: scope.$id,
                                            numColumns: scope.getActiveLayout(),
                                            bindDataSetChanged: true
                                        };
                                        scope.$root.$emit('filterDefs-modified', designerObj);
                                    }
                                    break;
                                case "layout":
                                    if (CONSTANTS.isStudioMode && scope.newcolumns) {
                                        scope.newcolumns = false;
                                        designerObj = {
                                            widgetName: scope.name,
                                            fieldDefs: scope.filterFields,
                                            buttonDefs: scope.buttonArray,
                                            variableName: scope.variableName,
                                            scopeId: scope.$id,
                                            numColumns: scope.getActiveLayout()
                                        };
                                        $rootScope.$emit('filterDefs-modified', designerObj);
                                    }
                                    break;
                                }
                            }

                            /* register the property change handler */
                            WidgetUtilService.registerPropertyChangeListener(propertyChangeHandler, scope, notifyFor);

                            /* event emitted on building new markup from canvasDom */
                            handlers.push($rootScope.$on('compile-filters', function (event, scopeId, markup, filterObj, variableName, fromDesigner) {

                                if (scope.$id === scopeId) {
                                    var markupObj = WM.element('<div>' + markup + '</div>'),
                                        fieldsObj = markupObj.find('wm-layoutgrid'),
                                        actionsObj = markupObj.find('wm-filter-action');

                                    scope.filterConstructed = fromDesigner;
                                    scope.variableName = variableName;
                                    scope.filterFields = undefined;
                                    scope.buttonArray = undefined;

                                    element.find('[data-identifier="filter-elements"]').empty();
                                    element.find('.basic-btn-grp').empty();

                                    /* if layout grid template found, simulate canvas dom addition of the elements */
                                    if (fieldsObj && fieldsObj.length) {
                                        $rootScope.$emit('prepare-element', fieldsObj, function () {
                                            element.find('[data-identifier="filter-elements"]').append(fieldsObj);
                                            element.find('.basic-btn-grp').append(actionsObj);
                                            $compile(fieldsObj)(scope);
                                            $compile(actionsObj)(scope);
                                        });
                                    } else {
                                        /* else compile and add the form fields */
                                        fieldsObj = markupObj.find('wm-filter-field');
                                        element.find('[data-identifier="filter-elements"]').append(fieldsObj);
                                        element.find('.basic-btn-grp').append(actionsObj);
                                        $compile(fieldsObj)(scope);
                                        $compile(actionsObj)(scope);
                                    }
                                    scope.filterConstructed = true;
                                }
                            }));
                            scope.$on("$destroy", function () {
                                handlers.forEach(Utils.triggerFn);
                            });
                            WidgetUtilService.postWidgetCreate(scope, element, attrs);
                        }
                    };
                }
            };
        }])
    .directive("wmFilterField", ["$compile", "Utils", "CONSTANTS", function ($compile, Utils, CONSTANTS) {
        'use strict';

        /* provides the template based on the form-field definition */
        var getTemplate = function (fieldDef, index) {
            var template = '',
                type;

            /*Construct the template based on the Widget Type, if widget type is not set refer to the fieldTypeWidgetTypeMap*/
            switch (fieldDef.widget) {
            case 'slider':
                template = template +
                    '<wm-composite widget="slider" show="{{filterFields[' + index + '].show}}">' +
                    '<wm-label class="col-md-4" caption="{{filterFields[' + index + '].displayName}}"></wm-label>' +
                    '<div class="col-md-8"><input type="range"/></div>' +
                    '</wm-composite>';
                break;
            case 'select':
                if (fieldDef.isRange) {
                    fieldDef.minPlaceholder = fieldDef.minPlaceholder || 'Enter Min Value';
                    fieldDef.maxPlaceholder = fieldDef.maxPlaceholder || 'Enter Max Value';
                    template = template +
                        '<wm-composite widget="select" show="{{filterFields[' + index + '].show}}">' +
                        '<wm-label class="col-md-4" caption="{{filterFields[' + index + '].displayName}}"></wm-label>' +
                        '<div class="col-md-4"><wm-select name="{{filterFields[' + index + '].field}}" scopedataset="filterFields[' + index + '].dataset" scopedatavalue="filterFields[' + index + '].minValue" datafield="{{filterFields[' + index + '].datafield}}" displayfield="{{filterFields[' + index + '].displayfield}}" placeholder="{{filterFields[' + index + '].minPlaceholder}}"></wm-select></div>' +
                        '<div class="col-md-4"><wm-select name="{{filterFields[' + index + '].field}}" scopedataset="filterFields[' + index + '].dataset" scopedatavalue="filterFields[' + index + '].maxValue" datafield="{{filterFields[' + index + '].datafield}}" displayfield="{{filterFields[' + index + '].displayfield}}" placeholder="{{filterFields[' + index + '].maxPlaceholder}}"></wm-select></div>' +
                        '</wm-composite>';
                } else {
                    fieldDef.minPlaceholder = fieldDef.minPlaceholder || 'Enter Value';
                    template = template + '<wm-composite widget="select" show="{{filterFields[' + index + '].show}}">' +
                        '<wm-label class="col-md-4" caption="{{filterFields[' + index + '].displayName}}"></wm-label>' +
                        '<div class="col-md-8"><wm-select name="{{filterFields[' + index + '].field}}" scopedataset="filterFields[' + index + '].dataset" scopedatavalue="filterFields[' + index + '].selected" datafield="{{filterFields[' + index + '].datafield}}" displayfield="{{filterFields[' + index + '].displayfield}}" placeholder="{{filterFields[' + index + '].minPlaceholder}}"';
                    if (fieldDef.multiple) {
                        template = template + 'multiple="{{filterFields[' + index + '].multiple}}"';
                    }
                    template = template + '></wm-select></div></wm-composite>';
                }
                break;
            case 'checkboxset':
                fieldDef.minPlaceholder = fieldDef.minPlaceholder || 'Enter Value';
                template = template + '<wm-composite widget="checkboxset" show="{{filterFields[' + index + '].show}}">' +
                    '<wm-label class="col-md-4" caption="{{filterFields[' + index + '].displayName}}"></wm-label>' +
                    '<div class="col-md-8"><wm-checkboxset name="{{filterFields[' + index + '].field}}" scopedataset="filterFields[' + index + '].dataset" scopedatavalue="filterFields[' + index + '].selected" datafield="{{filterFields[' + index + '].datafield}}" displayfield="{{filterFields[' + index + '].displayfield}}" placeholder="{{filterFields[' + index + '].minPlaceholder}}" dataset=""></wm-checkboxset></div>' +
                    '</wm-composite>';
                break;
            case 'radioset':
                if (fieldDef.isRange) {
                    fieldDef.minPlaceholder = fieldDef.minPlaceholder || 'Enter Min Value';
                    fieldDef.maxPlaceholder = fieldDef.maxPlaceholder || 'Enter Max Value';
                    template = template +
                        '<wm-composite widget="select" show="{{filterFields[' + index + '].show}}">' +
                        '<wm-label class="col-md-4" caption="{{filterFields[' + index + '].displayName}}"></wm-label>' +
                        '<div class="col-md-4"><wm-radioset name="{{filterFields[' + index + '].field}}" scopedataset="filterFields[' + index + '].dataset" scopedatavalue="filterFields[' + index + '].minValue" datafield="{{filterFields[' + index + '].datafield}}" displayfield="{{filterFields[' + index + '].displayfield}}" placeholder="{{filterFields[' + index + '].minPlaceholder}}" dataset=""></wm-radioset></div>' +
                        '<div class="col-md-4"><wm-radioset name="{{filterFields[' + index + '].field}}" scopedataset="filterFields[' + index + '].dataset" scopedatavalue="filterFields[' + index + '].maxValue" datafield="{{filterFields[' + index + '].datafield}}" displayfield="{{filterFields[' + index + '].displayfield}}" placeholder="{{filterFields[' + index + '].maxPlaceholder}}" dataset=""></wm-radioset></div>' +
                        '</wm-composite>';
                } else {
                    fieldDef.minPlaceholder = fieldDef.minPlaceholder || 'Enter Value';
                    template = template + '<wm-composite widget="radioset" show="{{filterFields[' + index + '].show}}">' +
                        '<wm-label class="col-md-4" caption="{{filterFields[' + index + '].displayName}}"></wm-label>' +
                        '<div class="col-md-8"><wm-radioset name="{{filterFields[' + index + '].field}}" scopedataset="filterFields[' + index + '].dataset" scopedatavalue="filterFields[' + index + '].selected" datafield="{{filterFields[' + index + '].datafield}}" displayfield="{{filterFields[' + index + '].displayfield}}" placeholder="{{filterFields[' + index + '].minPlaceholder}}" dataset=""></wm-radioset></div>' +
                        '</wm-composite>';
                }
                break;
            case 'text':
                if (fieldDef.isRange) {
                    fieldDef.minPlaceholder = fieldDef.minPlaceholder || 'Enter Min Value';
                    fieldDef.maxPlaceholder = fieldDef.maxPlaceholder || 'Enter Max Value';
                    type = (fieldDef.type === "integer") ? "number" : "string";
                    template = template +
                        '<wm-composite widget="text" show="{{filterFields[' + index + '].show}}">' +
                        '<wm-label class="col-md-4" caption="{{filterFields[' + index + '].displayName}}"></wm-label>' +
                        '<div class="col-md-4"><wm-text name="{{filterFields[' + index + '].field}}" scopedatavalue="filterFields[' + index + '].minValue" type="' + type + '" placeholder="{{filterFields[' + index + '].minPlaceholder}}"></wm-text></div>' +
                        '<div class="col-md-4"><wm-text name="{{filterFields[' + index + '].field}}" scopedatavalue="filterFields[' + index + '].maxValue" type="' + type + '" placeholder="{{filterFields[' + index + '].maxPlaceholder}}"></wm-text></div>' +
                        '</wm-composite>';
                } else {
                    fieldDef.minPlaceholder = fieldDef.minPlaceholder || 'Enter Value';
                    type = (fieldDef.type === "integer") ? "number" : "string";
                    template = template + '<wm-composite widget="text" show="{{filterFields[' + index + '].show}}">' +
                        '<wm-label class="col-md-4" caption="{{filterFields[' + index + '].displayName}}"></wm-label>' +
                        '<div class="col-md-8"><wm-text name="{{filterFields[' + index + '].field}}" scopedatavalue="filterFields[' + index + '].value" type="' + type + '" placeholder="{{filterFields[' + index + '].minPlaceholder}}"></wm-text></div>' +
                        '</wm-composite>';
                }
                break;
            case 'number':
                type = "number";
                if (fieldDef.isRange) {
                    fieldDef.minPlaceholder = fieldDef.minPlaceholder || 'Enter Min Value';
                    fieldDef.maxPlaceholder = fieldDef.maxPlaceholder || 'Enter Max Value';
                    template = template +
                        '<wm-composite widget="text" show="{{filterFields[' + index + '].show}}">' +
                        '<wm-label class="col-md-4" caption="{{filterFields[' + index + '].displayName}}"></wm-label>' +
                        '<div class="col-md-4"><wm-text name="{{filterFields[' + index + '].field}}" scopedatavalue="filterFields[' + index + '].minValue" type="' + type + '" placeholder="{{filterFields[' + index + '].minPlaceholder}}"></wm-text></div>' +
                        '<div class="col-md-4"><wm-text name="{{filterFields[' + index + '].field}}" scopedatavalue="filterFields[' + index + '].maxValue" type="' + type + '" placeholder="{{filterFields[' + index + '].maxPlaceholder}}"></wm-text></div>' +
                        '</wm-composite>';
                } else {
                    fieldDef.minPlaceholder = fieldDef.minPlaceholder || 'Enter Value';
                    template = template + '<wm-composite widget="text" show="{{filterFields[' + index + '].show}}">' +
                        '<wm-label class="col-md-4" caption="{{filterFields[' + index + '].displayName}}"></wm-label>' +
                        '<div class="col-md-8"><wm-text name="{{filterFields[' + index + '].field}}" scopedatavalue="filterFields[' + index + '].value" type="' + type + '" placeholder="{{filterFields[' + index + '].minPlaceholder}}"></wm-text></div>' +
                        '</wm-composite>';
                }
                break;
            case 'date':
                if (fieldDef.isRange) {
                    fieldDef.minPlaceholder = fieldDef.minPlaceholder || 'Enter Min Value';
                    fieldDef.maxPlaceholder = fieldDef.maxPlaceholder || 'Enter Max Value';
                    type = 'date';
                    template = template +
                        '<wm-composite widget="date" show="{{filterFields[' + index + '].show}}">' +
                        '<wm-label class="col-md-4" caption="{{filterFields[' + index + '].displayName}}"></wm-label>' +
                        '<div class="col-md-4"><wm-date name="{{filterFields[' + index + '].field}}" scopedatavalue="filterFields[' + index + '].minValue" placeholder="{{filterFields[' + index + '].minPlaceholder}}" datepattern="{{filterFields[' + index + '].datepattern}}"></wm-date></div>' +
                        '<div class="col-md-4"><wm-date name="{{filterFields[' + index + '].field}}" scopedatavalue="filterFields[' + index + '].maxValue" placeholder="{{filterFields[' + index + '].maxPlaceholder}}" datepattern="{{filterFields[' + index + '].datepattern}}"></wm-date></div>' +
                        '</wm-composite>';
                } else {
                    fieldDef.minPlaceholder = fieldDef.minPlaceholder || 'Enter Value';
                    type = 'date';
                    template = template + '<wm-composite widget="date" show="{{filterFields[' + index + '].show}}">' +
                        '<wm-label class="col-md-4" caption="{{filterFields[' + index + '].displayName}}"></wm-label>' +
                        '<div class="col-md-8"><wm-date name="{{filterFields[' + index + '].field}}" scopedatavalue="filterFields[' + index + '].value" placeholder="{{filterFields[' + index + '].minPlaceholder}}"  datepattern="{{filterFields[' + index + '].datepattern}}"></wm-date></div>' +
                        '</wm-composite>';
                }
                break;
            case 'checkbox':
                template = template + '<wm-composite widget="checkboxset" show="{{filterFields[' + index + '].show}}">' +
                    '<wm-label class="col-md-4" caption="{{filterFields[' + index + '].displayName}}"></wm-label>' +
                    '<div class="col-md-8"><wm-checkbox name="{{filterFields[' + index + '].field}}" scopedatavalue="filterFields[' + index + '].value" ></wm-checkbox></div>' +
                    '</wm-composite>';
                break;
            default:
                if (fieldDef.isRange) {
                    template = template +
                        '<wm-composite widget="text" show="{{filterFields[' + index + '].show}}">' +
                        '<wm-label class="col-md-4" caption="{{filterFields[' + index + '].displayName}}"></wm-label>' +
                        '<div class="col-md-4"><wm-text name="{{filterFields[' + index + '].field}}" scopedatavalue="filterFields[' + index + '].value" type="string"></wm-text></div>' +
                        '<div class="col-md-4"><wm-text name="{{filterFields[' + index + '].field}}" scopedatavalue="filterFields[' + index + '].value" type="string"></wm-text></div>' +
                        '</wm-composite>';
                } else {
                    template = template + '<wm-composite widget="text" show="{{filterFields[' + index + '].show}}">' +
                        '<wm-label class="col-md-4" caption="{{filterFields[' + index + '].displayName}}"></wm-label>' +
                        '<div class="col-md-8"><wm-text name="{{filterFields[' + index + '].field}}" scopedatavalue="filterFields[' + index + '].value" type="string"></wm-text></div>' +
                        '</wm-composite>';
                }
                break;
            }
            return template;
        };

        return {
            "restrict": 'E',
            "scope": true,
            "template": '',
            "replace": true,
            "compile": function () {
                return {
                    "post": function (scope, element, attrs) {
                        /*scope.$parent is defined when compiled with live filter scope*/
                        /*element.parent().isolateScope() is defined when compiled with dom scope*/
                        scope.parentIsolateScope = (element.parent() && element.parent().length > 0) ? element.parent().closest('[data-identifier="livefilter"]').isolateScope() : scope.$parent;

                        var expr,
                            exprWatchHandler,
                            variable,
                            colName,
                            exprArray,
                            template,
                            index,
                            fieldObject = {
                                'field': attrs.field || attrs.binding,
                                'displayName': attrs.displayName || attrs.caption,
                                'show': attrs.show === "true" || attrs.show === true,
                                'type': attrs.type || 'string',
                                'primaryKey': attrs.primaryKey === "true" || attrs.primaryKey === true,
                                'generator': attrs.generator,
                                'isRange': attrs.isRange === "true" || attrs.isRange === true,
                                'isRelated': attrs.isRelated === "true" || attrs.isRelated === true,
                                'filterOn': attrs.filterOn || attrs.field || attrs.binding,
                                'widget': attrs.widget,
                                'lookupType': attrs.lookupType,
                                'lookupField': attrs.lookupField,
                                'minPlaceholder': attrs.minPlaceholder,
                                'maxPlaceholder': attrs.maxPlaceholder,
                                'datepattern': attrs.datepattern,
                                'multiple': attrs.multiple === "true" || attrs.multiple === true,
                                'relatedEntityName': attrs.relatedEntityName
                            };
                        /*Set the default value*/
                        if (attrs.value) {
                            /*If the default value is bound variable, keep watch on the expression*/
                            if (Utils.stringStartsWith(attrs.value, 'bind:') && CONSTANTS.isRunMode) {
                                expr = attrs.value.replace('bind:', '');
                                if (scope.Variables && !Utils.isEmptyObject(scope.Variables) && scope.$eval(expr)) {
                                    fieldObject.value = scope.$eval(expr);
                                } else {
                                    /*TODO: Replace with new common binding function*/
                                    if (expr.indexOf('.content[$i].') !== -1) {
                                        exprArray = expr.split('.content[$i].');
                                        expr = exprArray[0];
                                        colName = exprArray[1];
                                    } else if (expr.indexOf('.data[$i].') !== -1) {
                                        exprArray = expr.split('.data[$i].');
                                        expr = exprArray[0];
                                        colName = exprArray[1];
                                    }
                                    exprWatchHandler = scope.parentIsolateScope.$watch(expr, function (newVal) {
                                        var val;
                                        variable = scope.parentIsolateScope.Variables[expr.split('.')[1]];
                                        if (exprArray && WM.isObject(newVal) && Utils.isPageable(newVal)) {
                                            val = newVal.content[0][colName];
                                        } else if (exprArray && variable.category === "wm.LiveVariable") {
                                            val = newVal.data && newVal.data[0][colName];
                                        } else {
                                            val = newVal;
                                        }
                                        scope.parentIsolateScope.filterFields[index].value = val;
                                        scope.parentIsolateScope.filterFields[index].selected = val;
                                        /*Apply the filter after the default value change*/
                                        scope.parentIsolateScope.filterOnDefault();
                                    });
                                }
                            } else {
                                fieldObject.value = attrs.value;
                                fieldObject.selected = attrs.value;
                            }
                        }
                        scope.parentIsolateScope.filterFields = scope.parentIsolateScope.filterFields || [];
                        scope.parentIsolateScope.fieldObjectCreated = true;
                        index = scope.parentIsolateScope.filterFields.push(fieldObject) - 1;

                        template = getTemplate(fieldObject, index);
                        element.html(template);
                        $compile(element.contents())(scope.parentIsolateScope);

                        scope.parentIsolateScope.$on('$destroy', function () {
                            if (exprWatchHandler) {
                                exprWatchHandler();
                            }
                        });
                    }
                };
            }
        };
    }])
    .directive("wmFilterAction", ["$compile", function ($compile) {
        'use strict';

        return {
            "restrict": 'E',
            "scope": true,
            "template": '',
            "replace": true,
            "compile": function () {
                return {
                    "post": function (scope, element, attrs) {
                        /*scope.$parent is defined when compiled with live filter scope*/
                        /*element.parent().isolateScope() is defined when compiled with dom scope*/
                        scope.parentIsolateScope = (element.parent() && element.parent().length > 0) ? element.parent().closest('[data-identifier="livefilter"]').isolateScope() : scope.$parent;

                        var buttonTemplate, index, buttonDef = {
                            'key': attrs.key || attrs.binding,
                            'displayName': attrs.displayName || attrs.caption,
                            'show': attrs.show === "true" || attrs.show === true,
                            'class': attrs.class || '',
                            'iconname': attrs.iconname,
                            'action': attrs.action
                        };
                        scope.parentIsolateScope.buttonArray = scope.parentIsolateScope.buttonArray || [];
                        index = scope.parentIsolateScope.buttonArray.push(buttonDef) - 1;
                        scope.parentIsolateScope.fieldObjectCreated = true;

                        buttonTemplate = '<wm-button caption="{{buttonArray[' + index + '].displayName}}" show="{{buttonArray[' + index + '].show}}" ' +
                            'class="{{buttonArray[' + index + '].class}}" iconname="{{buttonArray[' + index + '].iconname}}" ' +
                            'on-click="' + buttonDef.action + '" type="{{buttonArray[' + index + '].type}}" ></wm-button>';
                        element.closest('[data-identifier="livefilter"]').find('.basic-btn-grp').append($compile(buttonTemplate)(scope.parentIsolateScope));
                        $compile(element.contents())(scope.parentIsolateScope);
                    }
                };
            }
        };
    }]);
/**
 * @ngdoc directive
 * @name wm.widgets.live.directive:wmLivefilter
 * @restrict E
 *
 * @description
 * The 'wmLivefilter' directive defines a live filter in the layout.
 *
 * @scope
 * @requires PropertiesFactory
 * @requires WidgetUtilService
 * @requires $templateCache
 * @requires Variables
 * @requires QueryBuilder
 * @requires $compile
 * @requires $rootScope
 * @requires Utils
 * @requires CONSTANTS
 *
 * @param {string=} name
 *                  Name of the filter widget.
 * @param {string=} width
 *                  Width of the filter widget.
 * @param {string=} height
 *                  Height of the filter widget.
 * @param {string=} layout
 *                  This property controls how contained widgets are displayed within the widget container. <br>
 *                  Possible values are `One Column`, `Two Column`, `Three Column`, and `Four Column`. <br>
 *                  Default value is `One Column`.
 * @param {string=} scopedataset
 *                  This property sets a variable to populate the data required to display the list of values.
 * @param {string=} dataset
 *                  This property sets the data to show in the filter. <br>
 *                  This is a bindable property.
 * @param {boolean=} show
 *                  This is a bindable property. <br>
 *                  This property will be used to show/hide the filter on the web page. <br>
 *                  default value: `true`.
 * @param {string=} horizontalalign
 *                  This property used to set text alignment horizontally. <br>
 *                  Possible values are `left`, `center` and `right`.
 *
 * @example
 <example module="wmCore">
 <file name="index.html">
 <wm-livefilter>
 </wm-livefilter>
 </file>
 </example>
 */

