/*global WM, wm*/
/*jslint sub: true */

/**
 * @ngdoc service
 * @name wm.webservice.$ServiceFactory
 * @description
 * The `ServiceFactory` keeps and exposes the services and their details in an object.
 */
wm.plugins.webServices.factories.ServiceFactory = [
    "WebService",
    "wmToaster",
    "$rootScope",
    "Utils",
    "VARIABLE_CONSTANTS",

    function (WebService, wmToaster, $rootScope, Utils, VARIABLE_CONSTANTS) {
        "use strict";

        /*Array to hold service objects*/
        var services = [],
            projectId = $rootScope.project && $rootScope.project.id,
            requestQueue = {
                'services': [],
                'operations': {},
                'serviceDef': {}
            },
            serviceDefMap = {},

        /*function to get service object matching its name*/
            getServiceObjectByName = function (name) {
                var serviceObject = {operations: []};
                WM.forEach(services, function (serviceObj) {
                    if (serviceObj.name === name) {
                        serviceObject = serviceObj;
                    }
                });
                return serviceObject;
            },

        /*function to get service operation object matching its name*/
            getServiceOperationObjectByName = function (serviceName, operationName) {
                var serviceObj, operationObject = {};
                serviceObj = getServiceObjectByName(serviceName);
                WM.forEach(serviceObj.operations, function (operation) {
                    if (operation.name === operationName) {
                        operationObject = operation;
                    }
                });
                return operationObject;
            },

        /*function to get list of services from the backend*/
            getServicesWithType = function (successCallBack, reloadFlag) {
                /*sanity checking of the params*/
                reloadFlag = !((!reloadFlag || reloadFlag === 'false'));

                /*if services already fetched once and reloadFlag not set, return the fetched services*/
                if (services.length > 0 && !reloadFlag) {
                    Utils.triggerFn(successCallBack, services);
                    return;
                }

                requestQueue['services'] = requestQueue['services'] || [];
                requestQueue['services'].push(successCallBack);
                /* if same queue is already in progress, do not send another request */
                if (requestQueue['services'].length > 1) {
                    return;
                }

                /*data for the request*/
                var urlParams = {
                    projectID: projectId || $rootScope.project.id
                };

                /* Fetch the available web/data services for the current project*/
                WebService.listServicesWithType(urlParams, function (response) {
                    /*clean the array before inserting the fetched services*/
                    services = [];

                    /*loop over the response to fill the services variable*/
                    WM.forEach(response, function (serviceObj) {
                        services.push({
                            type: serviceObj.type,
                            name: serviceObj.name,
                            url: serviceObj.url,
                            operations: []
                        });
                    });

                    /*send the services to the callback*/
                    WM.forEach(requestQueue['services'], function (fn) {
                        Utils.triggerFn(fn, services);
                    });
                    requestQueue['services'] = null;
                }, function () {
                    wmToaster.show("error", $rootScope.locale["MESSAGE_ERROR_TITLE"], $rootScope.locale["MESSAGE_ERROR_FETCH_WEB_DATA_SERVICES_DESC"]);
                });
            },

            /*function to get the full serviceDef (api doc)*/
            getServiceDef = function (serviceId, success, error, forceReload) {
                var callback,
                    urlParams = {
                        "urlParams": {
                            serviceId: serviceId,
                            projectId: $rootScope.project.id
                        }
                    };
                if (serviceDefMap[serviceId] && !forceReload) {
                    /*if operations are already present, return the cached response*/
                    Utils.triggerFn(success, serviceDefMap[serviceId]);
                    return;
                }

                requestQueue['serviceDef'][serviceId] = requestQueue['serviceDef'][serviceId] || [];
                requestQueue['serviceDef'][serviceId].push(success);
                /* if same queue is already in progress, do not send another request */
                if (requestQueue['serviceDef'][serviceId].length > 1) {
                    return;
                }

                /*invoking a service to get the operations that a particular service has and it's
                 * parameters to create a unique url pattern*/
                WebService.retrieveServiceOperations(urlParams, function (response) {
                    serviceDefMap[serviceId] = response;
                    /*while loop is used so that any requests that come when the response is being served; are also handled.*/
                    while (true) {
                        callback = requestQueue['serviceDef'][serviceId].shift();
                        Utils.triggerFn(callback, response);
                        if (!requestQueue['serviceDef'][serviceId].length) {
                            break;
                        }
                    }
                }, function (errMsg) {
                    Utils.triggerFn(error, errMsg);
                });
            },

            processOperations = function (serviceObj, operations) {
                var paramsKey,
                    opTypeRefsKey,
                    listOpTypeRefsKey,
                    paramTypeRefsKey,
                    paramTypeListRefsKey,
                    isListKey,
                    isParamListKey,
                    isRestSupportedService = VARIABLE_CONSTANTS.REST_SUPPORTED_SERVICES.indexOf(serviceObj.type) !== -1,
                    PAGE_TYPE = "org.springframework.data.domain.Page";
                if (isRestSupportedService) {
                    paramsKey = "parameters";
                    opTypeRefsKey = "fullyQualifiedReturnType";
                    listOpTypeRefsKey = "fullyQualifiedReturnTypeArguments";
                    paramTypeRefsKey = "fullyQualifiedType";
                    paramTypeListRefsKey = "fullyQualifiedTypeArguments";
                    isListKey = "returnTypeList";
                    isParamListKey = "list";
                } else {
                    paramsKey = "parameter";
                    opTypeRefsKey = "return";
                    paramTypeRefsKey = "typeRef";
                    isParamListKey = "isList";
                }
                /*Empty the "operations" so that they are set based on the response.*/
                serviceObj.operations = [];

                /*loop through the operations to append them to the respective service object*/
                WM.forEach(operations, function (operation) {
                    /*variable to determine if the fetched operation already exists*/
                    var operationObject = {},
                        isList,
                        typeRef,
                        returnObj;

                    /* special case for pageable return type */
                    if (isRestSupportedService) {
                        isList = operation[isListKey];
                        typeRef = (isList || operation[opTypeRefsKey] === PAGE_TYPE) ? (operation[listOpTypeRefsKey][0] || 'java.lang.Object') : ((operation[listOpTypeRefsKey] && operation[listOpTypeRefsKey][0]) || operation[opTypeRefsKey]);
                        returnObj = {typeRef: typeRef};
                    } else {
                        returnObj = operation[opTypeRefsKey];
                    }

                    /*push the operation only if does not exist previously*/
                    operationObject = {
                        name: operation.name,
                        operationType: operation.operationType || null,
                        parameter: undefined,
                        return: returnObj
                    };
                    serviceObj.operations.push(operationObject);

                    /* process the operation params as well */
                    if (!WM.element.isEmptyObject(operation[paramsKey])) {
                        operationObject.parameter = [];
                        WM.forEach(operation[paramsKey], function (param) {

                            isList = param[isParamListKey];
                            if (isRestSupportedService) {
                                typeRef = isList ? (param[paramTypeListRefsKey][0] || 'java.lang.Object') : param[paramTypeRefsKey];
                            } else {
                                typeRef = param[paramTypeRefsKey];
                            }
                            operationObject.parameter.push({
                                name: param.name,
                                typeRef: typeRef,
                                isList: isList,
                                parameterType: param.parameterType
                            });
                        });
                    }
                });
            },

        /*function to get list of operations for a service from the backend*/
            getServiceOperations = function (serviceId, successCallBack, reloadFlag) {
                /*sanity checking of the params*/
                if (!serviceId || serviceId === '') {
                    return;
                }
                reloadFlag = !(!reloadFlag || reloadFlag === 'false');

                /*get the required service object*/
                var serviceObj = getServiceObjectByName(serviceId),
                    urlParams,
                    operations,
                    onOperationsFetch = function (operations) {
                        processOperations(serviceObj, operations);
                        var callback;

                        /*while loop is used so that any requests that come when the response is being served; are also handled.*/
                        while (true) {
                            callback = requestQueue['operations'][serviceId].shift();
                            Utils.triggerFn(callback, serviceObj.operations);
                            if (!requestQueue['operations'][serviceId].length) {
                                break;
                            }
                        }
                    };

                /*if service's operations already fetched once and reloadFlag not set, return the fetched operations*/
                if (serviceObj.operations.length > 0 && !reloadFlag) {
                    Utils.triggerFn(successCallBack, serviceObj.operations);
                    return;
                }

                requestQueue['operations'][serviceId] = requestQueue['operations'][serviceId] || [];
                requestQueue['operations'][serviceId].push(successCallBack);
                /* if same queue is already in progress, do not send another request */
                if (requestQueue['operations'][serviceId].length > 1) {
                    return;
                }


                if (VARIABLE_CONSTANTS.REST_SUPPORTED_SERVICES.indexOf(serviceObj.type) !== -1) {
                    operations = [];

                    /* invoking a service to get the operations that a particular service has and it's
                     * parameters to create a unique url pattern
                     */
                    getServiceDef(serviceId, function (response) {
                        /*iterate over the apiDocuments received from the service response*/
                        response.apiDocuments.forEach(function (apiDocument) {
                            /*iterate over the endPoints available in each apiDocument*/
                            apiDocument.endPoints.forEach(function (endPoint) {
                                endPoint.operations.forEach(function (operation) {
                                    operations.push(operation);
                                });
                            });
                        });
                        /*pass the data prepared to the success callback function*/
                        onOperationsFetch(operations);
                    }, function () {
                        /*handle error response*/
                        wmToaster.show("error", $rootScope.locale["MESSAGE_ERROR_TITLE"], $rootScope.locale["MESSAGE_ERROR_FETCH_SERVICE_METHODS_DESC"]);
                    }, reloadFlag);
                } else {
                    /*data for the request*/
                    urlParams = {
                        projectID: projectId || $rootScope.project.id,
                        serviceID: serviceId
                    };
                    /*Get the operations for the service*/
                    WebService.getServiceOperations(urlParams, function (response) {
                        onOperationsFetch(response);
                    }, function () {
                        wmToaster.show("error", $rootScope.locale["MESSAGE_ERROR_TITLE"], $rootScope.locale["MESSAGE_ERROR_FETCH_SERVICE_METHODS_DESC"]);
                    });
                }
            },
        /*function to get list of params and return type for an operation of a service from the backend*/
            getServiceOperationParams = function (serviceId, operationId, successCallBack, reloadFlag) {
                /*sanity checking of the params*/
                if (!serviceId || serviceId === '' || !operationId || operationId === '') {
                    return;
                }
                reloadFlag = !(!reloadFlag || reloadFlag === 'false');

                /*get the required operation object*/
                var serviceObj = getServiceObjectByName(serviceId),
                    operationObj = getServiceOperationObjectByName(serviceId, operationId),
                    urlParams,
                    onOperationParamsFetch = function (response, isRestSupported) {
                        var parameters = isRestSupported ? response.parameters : response.parameter;
                        /*Create parameter property for the operations object, if parameters exist.*/
                        if (!WM.element.isEmptyObject(parameters)) {
                            operationObj.parameter = [];

                            /*loop through the operation params to append them to the tree*/
                            WM.forEach(parameters, function (param) {
                                var paramExists = false,
                                    paramTypeRefsKey,
                                    paramTypeListRefsKey,
                                    isParamListKey,
                                    isList,
                                    typeRef,
                                    isRestSupportedService = VARIABLE_CONSTANTS.REST_SUPPORTED_SERVICES.indexOf(serviceObj.type) !== -1;
                                if (isRestSupportedService) {
                                    paramTypeRefsKey = "fullyQualifiedType";
                                    paramTypeListRefsKey = "fullyQualifiedTypeArguments";
                                    isParamListKey = "list";
                                } else {
                                    paramTypeRefsKey = "typeRef";
                                    isParamListKey = "isList";
                                }

                                /*loop through the existing params for the operation object to check existence of fetched params*/
                                WM.forEach(operationObj.parameter, function (existingParam) {
                                    /*if the param already exists, set flag to prevent duplicate entry*/
                                    if (param.name === existingParam.name) {
                                        paramExists = true;
                                    }
                                });

                                isList = param[isParamListKey];
                                if (isRestSupportedService) {
                                    typeRef = isList ? (param[paramTypeListRefsKey][0] || 'java.lang.Object') : param[paramTypeRefsKey];
                                } else {
                                    typeRef = param[paramTypeRefsKey];
                                }

                                /*if the param is not already fetched push it to the list*/
                                if (!paramExists) {
                                    operationObj.parameter.push({
                                        name: param.name,
                                        typeRef: typeRef,
                                        isList: isList,
                                        parameterType: param.parameterType
                                    });
                                }
                            });
                        }

                        /*append the return types for this operation*/
                        operationObj['return'] = response['return'] || {'typeRef': 'java.lang.String', 'isList': false};
                        Utils.triggerFn(successCallBack, operationObj);
                    };

                /*if service's operation's params already fetched once and reloadFlag not set, return the fetched params*/
                if (operationObj.parameter && !reloadFlag) {
                    Utils.triggerFn(successCallBack, operationObj);
                    return;
                }

                if (VARIABLE_CONSTANTS.REST_SUPPORTED_SERVICES.indexOf(getServiceObjectByName(serviceId).type) !== -1) {
                    getServiceOperations(serviceId, function () {
                        onOperationParamsFetch(getServiceOperationObjectByName(serviceId, operationId), true);
                    }, true);
                } else {
                    urlParams = {
                        projectID: projectId || $rootScope.project.id,
                        serviceID: serviceId,
                        operationID: operationId
                    };
                    /*call web service to fetch the data*/
                    WebService.getServiceOperationParams(urlParams, function (response) {
                        onOperationParamsFetch(response);
                    }, function () {
                        wmToaster.show("error", $rootScope.locale["MESSAGE_ERROR_TITLE"], $rootScope.locale["MESSAGE_ERROR_FETCH_SERVICE_METHOD_PARAMS_DESC"]);
                    });
                }
            },
            addService = function (service) {
                /*variable to decide if service already exists*/
                var serviceExists = false;

                WM.forEach(services, function (existingService) {
                    /*if service exists set the flag to prevent duplicate entry*/
                    if (service.name === existingService.name && service.type === existingService.type) {
                        serviceExists = true;
                    }
                });

                /*if service does not exist, do not append*/
                if (!serviceExists) {
                    services.push({name: service.name, type: service.type, operations: [], url: service.url || "/services/" + service.name, sampleResponse: service.sampleResponse});
                }

                /* return true/false for the status */
                return !serviceExists;
            },

            /* gets the sample response for a webservice */
            getSampleResponse = function (serviceId) {
                var service = getServiceObjectByName(serviceId);

                return service.sampleResponse;
            },

            /* stores the sample response fpr a webservice */
            setSampleResponse = function (serviceId, response) {
                var service = getServiceObjectByName(serviceId);

                service.sampleResponse = response;
            };

        return {
            /**
             * @ngdoc function
             * @name wm.webservice.$ServiceFactory#getServicesWithType
             * @methodOf wm.webservice.$ServiceFactory
             * @function
             *
             * @description
             * gets a list of all services in the project (else throws an error).
             *
             * @param {function} successCallback providing the services list
             * @param {boolean} reloadFlag to determine if a refreshed list is required form backend (default false)
             */
            getServicesWithType: getServicesWithType,

            /**
             * @ngdoc function
             * @name wm.webservice.$ServiceFactory#getServiceOperations
             * @methodOf wm.webservice.$ServiceFactory
             * @function
             *
             * @description
             * gets a list of all operations in a service (else throws an error).
             *
             * @param {string} serviceId name of the service for which operations are required
             * @param {function} successCallback providing the operation list as function parameter
             * @param {boolean} reloadFlag to determine if a refreshed list is required form backend (default false)
             */
            getServiceOperations: getServiceOperations,

            /**
             * @ngdoc function
             * @name wm.webservice.$ServiceFactory#getServiceOperationParams
             * @methodOf wm.webservice.$ServiceFactory
             * @function
             *
             * @description
             * gets a list of all params of an operation in a service (else throws an error).
             *
             * @param {string} serviceId name of the service containing the operation
             * @param {string} operationId name of the operation of the service for which params are required
             * @param {function} successCallback providing the params list as function parameter
             * @param {boolean} reloadFlag to determine if a refreshed list is required form backend (default false)
             */
            getServiceOperationParams: getServiceOperationParams,

            /**
             * @ngdoc function
             * @name wm.webservice.$ServiceFactory#add
             * @methodOf wm.webservice.$ServiceFactory
             * @function
             *
             * @description
             * adds a service to the existing services list factory.
             *
             * @param {object} service details of the service to be added

             * @returns {boolean} true if service added, else false
             */
            add: addService,

            /**
             * @ngdoc function
             * @name wm.webservice.$ServiceFactory#getServiceObjectByName
             * @methodOf wm.webservice.$ServiceFactory
             * @function
             *
             * @description
             * returns an object having details of a service matching the supplied name
             *
             * @param {string} name name of the service the details of which are required.

             * @returns {object} having service details
             */
            getServiceObjectByName: getServiceObjectByName,

            /**
             * @ngdoc function
             * @name wm.webservice.$ServiceFactory#getSampleOutput
             * @methodOf wm.webservice.$ServiceFactory
             * @function
             *
             * @description
             * returns the sample output returned while testing the service
             *
             * @param {string} name name of the service

             * @returns {object} having service output
             */
            getSampleResponse: getSampleResponse,

            /**
             * @ngdoc function
             * @name wm.webservice.$ServiceFactory#setSampleOutput
             * @methodOf wm.webservice.$ServiceFactory
             * @function
             *
             * @description
             * stores the sample output returned while testing the service against that service namespace
             *
             * @param {serviceId} service id
             * @param {object} having service output
             */
            setSampleResponse: setSampleResponse,

            /**
             * @ngdoc function
             * @name wm.webservice.$ServiceFactory#getServiceDef
             * @methodOf wm.webservice.$ServiceFactory
             * @function
             *
             * @description
             * gets the api-doc service definition for provided serviceId
             *
             * @param {serviceId} service id
             * @param {object} having service output
             */
            getServiceDef: getServiceDef
        };
    }
];