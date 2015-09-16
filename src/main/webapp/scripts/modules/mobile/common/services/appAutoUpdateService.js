/*global wm, WM, cordova*/
/*jslint sub: true */
WM.module('wm.widgets.advanced')
    .run(['$templateCache', function ($templateCache) {
        'use strict';

        $templateCache.put('template/widget/advanced/appUpdate.html',
            '<div class="modal fade in" data-ng-style="{display : show ? \'block\' : \'none\'}">' +
                '<div class="modal-dialog">' +
                    '<div class="modal-content">' +
                        '<div class="modal-body">' +
                            '<span>{{message}}</span>' +
                            '<div class="progress" data-ng-show="downloading">' +
                                '<div class="progress-bar" data-ng-style="{ \'width\' : downloadProgress + \'%\'}"></div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="modal-footer">' +
                            '<button type="button" class="btn btn-default" data-dismiss="modal" data-ng-click="cancel()">' +
                                'Continue with existing App.' +
                            '</button>' +
                            '<button type="button" class="btn btn-primary" data-ng-hide="downloading" data-ng-click="updateApp()">' +
                                'Update' +
                            '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>');
    }]);

wm.modules.wmCommon.services.AppAutoUpdateService = [
    '$compile',
    '$cordovaFileOpener2',
    '$cordovaFileTransfer',
    '$http',
    '$q',
    '$rootScope',
    '$templateCache',
    function ($compile, $cordovaFileOpener2, $cordovaFileTransfer, $http, $q, $rootScope, $templateCache) {
        'use strict';
        var config, ele, scope;


        function installLatestVersion() {
            var downloadLink = config.host + '/appBuild/rest/mobileBuilds/download?',
                fileName = 'app-build-' + config.latestBuildNumber + '.apk',
                apkFile =  cordova.file.externalApplicationStorageDirectory + fileName;

            downloadLink += 'token=' + config.token
                            + '&buildNumber=' + config.latestBuildNumber
                            + '&fileName=' + fileName;
            $cordovaFileTransfer.download(downloadLink, apkFile, {}, true)
                .then(function () {
                    $cordovaFileOpener2.open(apkFile, 'application/vnd.android.package-archive');
                }, function () {
                    scope.message = 'Failed to download latest version.';
                }, function (progress) {
                    scope.downloadProgress = (progress.loaded / progress.total) * 100;
                });
            scope.message = 'Downloading the latest version ['+ config.latestVersion +'].';
            scope.downloading = true;
        }

        function getUserConfirmationAndInstall() {
            scope = $rootScope.$new();
            scope.downloadProgress = 0;
            scope.updateApp = installLatestVersion;
            scope.show = true;
            scope.downloading = false;
            scope.message = 'There is an update available. Would you like to update the app?';
            scope.cancel = function () {
                ele.remove();
                scope.$destroy();
            };
            ele = $compile($templateCache.get('template/widget/advanced/appUpdate.html'))(scope);
            WM.element('body:first').append(ele);
            $templateCache.remove('template/widget/advanced/appUpdate.html');
        }

        function checkForUpdate() {
            var deferred = $q.defer();
            $http.get(config.host + '/appBuild/rest/mobileBuilds/latest_build?token=' + config.token)
                .then(function (response) {
                    var latestBuildNumber = response.data.success.body.buildNumber,
                        latestVersion =  response.data.success.body.version;
                    if (config.buildNumber < latestBuildNumber) {
                        config.latestBuildNumber = latestBuildNumber;
                        config.latestVersion = latestVersion;
                        deferred.resolve(latestBuildNumber);
                    } else {
                        deferred.reject();
                    }
                });
            return deferred.promise;
        }

        this.start = function () {
            $http.get('./build_meta.json')
                .then(function (response) {
                    config = response.data;
                    if (config.buildMode === 'DEVELOPMENT_MODE') {
                        checkForUpdate().then(getUserConfirmationAndInstall.bind(undefined));
                    }
                });
        };
    }];