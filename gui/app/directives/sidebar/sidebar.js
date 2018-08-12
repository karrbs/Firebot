"use strict";

(function() {
    angular.module("firebotApp").component("sidebar", {
        bindings: {},
        template: `
            <div class="fb-nav" ng-class="{'contracted': !$ctrl.sbm.navExpanded}">
                <div class="nav-header">
                    <img class="nav-header-icon" ng-class="{'contracted': !$ctrl.sbm.navExpanded}" src="../images/logo_transparent.png">      
                    <span class="nav-header-title" ng-class="{'contracted': !$ctrl.sbm.navExpanded}">Firebot</span>
                    <span class="nav-expand-button" ng-class="{'contracted': !$ctrl.sbm.navExpanded}" ng-click="$ctrl.sbm.toggleNav()">
                        <i class="fal" ng-class="$ctrl.sbm.navExpanded ? 'fa-angle-left' : 'fa-angle-right'"></i>
                    </span>
                </div>
                <div class="nav-body-wrapper">
                    <div class="nav-links-wrapper" ng-class="{'contracted': !$ctrl.sbm.navExpanded}">

                        <nav-category name="{{'SIDEBAR.INTERACTIVE' | translate }}"></nav-category>
                        <nav-link page="Buttons" name="{{'SIDEBAR.INTERACTIVE.BUTTONS' | translate }}" icon="fa-gamepad" is-index="true"></nav-link>

                        <nav-category name="{{'SIDEBAR.CHAT' | translate }}" pad-top="true"></nav-category>
                        <nav-link page="Commands" name="{{'SIDEBAR.CHAT.COMMANDS' | translate }}" icon="fa-exclamation"></nav-link>
                        <nav-link page="Chat Feed" name="{{'SIDEBAR.CHAT.CHAT_FEED' | translate }}" icon="fa-commenting"></nav-link>

                        <nav-category name="{{'SIDEBAR.OTHER' | translate }}" pad-top="true"></nav-category>
                        <nav-link page="Events" name="{{'SIDEBAR.OTHER.EVENTS' | translate }}" icon="fa-star"></nav-link>
                        <nav-link page="Timers" name="{{'SIDEBAR.OTHER.TIMERS' | translate }}" icon="fa-stopwatch"></nav-link>
                        <nav-link page="Hotkeys" name="{{'SIDEBAR.OTHER.HOTKEYS' | translate }}" icon="fa-keyboard"></nav-link>

                        <nav-category name="{{'SIDEBAR.MANAGEMENT' | translate }}" pad-top="true"></nav-category>
                        <nav-link page="Viewers" name="{{'SIDEBAR.MANAGEMENT.VIEWERS' | translate }}" icon="fa-users" ng-if="$ctrl.isViewerDBOn()"></nav-link>
                        <nav-link page="Viewer Groups" name="{{'SIDEBAR.MANAGEMENT.VIEWER_GROUPS' | translate }}" icon="fa-users-class"></nav-link>
                        <nav-link page="Moderation" name="{{'SIDEBAR.MANAGEMENT.MODERATION' | translate }}" icon="fa-gavel"></nav-link>
                        <nav-link page="Currency" name="{{'SIDEBAR.MANAGEMENT.CURRENCY' | translate }}" icon="fa-money-bill" ng-if="$ctrl.isViewerDBOn()"></nav-link>           
                        <nav-link page="Settings" name="{{'SIDEBAR.MANAGEMENT.SETTINGS' | translate }}" icon="fa-cog"></nav-link>
                        <nav-link page="Updates" name="{{'SIDEBAR.MANAGEMENT.UPDATES' | translate }}" icon="fa-download" badge-text="$ctrl.updateIsAvailable() ? 'NEW' : ''"></nav-link>

                    </div>
        
                    <div class="connection-status-wrapper">
                        <div class='interactive-status-wrapper'>
                            <div class="interative-status-icon" 
                                ng-class="{'contracted': !$ctrl.sbm.navExpanded, 'connected': $ctrl.cm.allServicesConnected(), 'partial-connected': $ctrl.cm.partialServicesConnected()}" 
                                uib-tooltip-template="'connectTooltipTemplate.html'" 
                                tooltip-placement="{{!$ctrl.sbm.navExpanded ? 'right-bottom' : 'top-left'}}"
                                tooltip-append-to-body="true"
                                ng-click="$ctrl.cm.toggleSidebarServices()">
                                <i class="fal" ng-class="$ctrl.cm.isWaitingForServicesStatusChange() ? 'fa-sync fa-spin force-white-text' : 'fa-power-off'"></i>
                            </div>
                            <div>
                                <div class="interactive-status-text">
                                    <div class="interative-status-title" ng-class="{'contracted': !$ctrl.sbm.navExpanded}">
                                        <span>Connections</span>
                                    </div>
                                    <div class="interative-status-subtitle" ng-class="{'contracted': !$ctrl.sbm.navExpanded}">
                                        <span style="width: 100%;display: flex;justify-content: space-between;margin-top: 5px;">
                                            <connection-icon type="interactive"></connection-icon>
                                            <connection-icon type="chat"></connection-icon>
                                            <connection-icon type="constellation"></connection-icon>
                                            <connection-icon type="overlay"></connection-icon>                                          
                                            <connection-icon type="integrations" ng-if="$ctrl.is.oneIntegrationIsLinked()"></connection-icon>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        
                            <div class="connection-panel-btn" ng-class="{'contracted': !$ctrl.sbm.navExpanded}" uib-tooltip="Open Connection Panel" tooltip-append-to-body="true"
                                ng-click="$ctrl.showConnectionPanelModal()">
                                <span><i class="fal fa-external-link-alt"></i></span>
                            </div>
                        </div>
            
                        <div class="about-link" 
                            ng-class="{'contracted': !$ctrl.sbm.navExpanded}"
                            ng-click="$ctrl.showAboutFirebotModal()">{{"SIDEBAR.ABOUT" | translate }}
                        </div>
                    </div>
                </div>

                <!-- Tooltip template -->
                <script type="text/ng-template" id="connectTooltipTemplate.html">
                  <div ng-if="!$ctrl.sbm.navExpanded">
                    <span>
                        <span><b>Interactive Status:</b></span>
                        </br> 
                        <span>{{$ctrl.cs.connectedToInteractive ? 'CONNECTED' : 'DISCONNECTED' | translate }}</span>
                        <span ng-if="$ctrl.cs.connectedToInteractive"></br>{{'(' +  $ctrl.cs.connectedBoard + ')'}}</span>     
                        </br></br>
                      </span>
                      <span>
                        <span><b>Chat Status:</b></span>
                        </br> 
                        <span>{{$ctrl.cs.connectedToChat ? 'CONNECTED' : 'DISCONNECTED' | translate }}</span>     
                        </br></br>
                      </span>
                      <span>
                        <span><b>Constellation Status:</b></span>
                        </br> 
                        <span>{{$ctrl.cs.connectedToConstellation ? 'CONNECTED' : 'DISCONNECTED' | translate }}</span>     
                        </br></br>
                      </span>
                      <span>
                          <span><b>Overlay Status:</b></span>
                          </br> 
                          <span>{{$ctrl.wss.hasClientsConnected ? 'CONNECTED' : 'RUNNING_NOT_CONNECTED' | translate }}</span>     
                          </br></br>
                        </span>
                  </div>
                  <span>{{'SIDEBAR.CONNECTIONS.MIXER_TOGGLE' | translate }}</span>
                </script>
            </div>
            `,
        controller: function(
            sidebarManager,
            connectionManager,
            updatesService,
            connectionService,
            integrationService,
            websocketService,
            utilityService,
            settingsService
        ) {
            let ctrl = this;

            ctrl.sbm = sidebarManager;

            ctrl.cm = connectionManager;

            ctrl.cs = connectionService;

            ctrl.wss = websocketService;

            ctrl.is = integrationService;

            ctrl.isViewerDBOn = settingsService.getViewerDB;

            ctrl.showConnectionPanelModal = function() {
                utilityService.showModal({
                    component: "connectionPanelModal",
                    windowClass: "connection-panel-modal"
                });
            };

            ctrl.showAboutFirebotModal = function() {
                utilityService.showModal({
                    component: "aboutModal",
                    size: "sm"
                });
            };

            ctrl.updateIsAvailable = () => {
                return updatesService.updateIsAvailable();
            };

            ctrl.$onInit = function() {};
        }
    });
}());
