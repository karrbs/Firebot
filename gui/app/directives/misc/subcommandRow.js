"use strict";

(function() {
    angular.module("firebotApp").component("subcommandRow", {
        bindings: {
            subcommand: "=",
            cmdTrigger: "@"
        },
        template: `
      <div style="margin-bottom: 10px">
        <div class="sys-command-row" ng-init="hidePanel = true" ng-click="hidePanel = !hidePanel" ng-class="{'expanded': !hidePanel}">

          <div style="flex-basis: 30%;padding-left: 20px;">{{$ctrl.subcommand.arg}}</div>

          <div style="width: 25%">
            <span style="min-width: 51px; display: inline-block;" uib-tooltip="Global cooldown">
                <i class="fal fa-globe"></i> {{$ctrl.subcommand.cooldown.global ? $ctrl.subcommand.cooldown.global + "s" : "-" }}
            </span>
            <span uib-tooltip="User cooldown">
                <i class="fal fa-user"></i> {{$ctrl.subcommand.cooldown.user ? $ctrl.subcommand.cooldown.user + "s" : "-" }}
            </span>
          </div>

          <div style="width: 25%"><span style="text-transform: capitalize;">{{$ctrl.subcommand.permission.type}}</span> <tooltip type="info" text="$ctrl.getPermissionTooltip($ctrl.subcommand, true)"></tooltip></div>

          <div style="width: 25%">
            <div style="min-width: 75px">
                <span class="status-dot" ng-class="{'active': $ctrl.subcommand.active, 'notactive': !$ctrl.subcommand.active}"></span> {{$ctrl.subcommand.active ? "Active" : "Disabled"}}
            </div> 
          </div>

          <div style="flex-basis:30px; flex-shrink: 0;">
            <i class="fas" ng-class="{'fa-chevron-right': hidePanel, 'fa-chevron-down': !hidePanel}"></i>
          </div>
        </div>

        <div uib-collapse="hidePanel" class="sys-command-expanded">
          <div style="padding: 15px 20px 10px 20px;">

            <div class="muted" style="font-weight:bold; font-size: 12px;">DESCRIPTION</div>
            <p style="font-size: 18px">{{$ctrl.subcommand.description}}</p>

            <div style="padding-bottom:10px">
              <div class="muted" style="font-weight:bold; font-size: 12px;">USAGE</div>
              <p style="font-size: 15px;font-weight: 600;">{{$ctrl.cmdTrigger}} {{$ctrl.subcommand.usage ? $ctrl.subcommand.usage : $ctrl.subcommand.arg}}</p>
            </div>

            <h4>Settings</h4>
            <div class="controls-fb-inline" style="padding-bottom:10px">
              <label class="control-fb control--checkbox">Is Active
                  <input type="checkbox" ng-model="$ctrl.subcommand.active" aria-label="..." checked>
                  <div class="control__indicator"></div>
              </label>

              <label class="control-fb control--checkbox">Auto Delete Trigger <tooltip text="'Have Firebot automatically delete the message that triggers this subcommand to keep chat cleaner.'"></tooltip>
                  <input type="checkbox" ng-model="$ctrl.subcommand.autoDeleteTrigger" aria-label="...">
                  <div class="control__indicator"></div>
              </label>
            </div>

            <div style="padding-bottom:10px">
              <div class="muted" style="font-weight:bold; font-size: 12px;">COOLDOWNS</div>
              <div class="input-group">
                <span class="input-group-addon">Global</span>
                <input 
                    class="form-control" 
                    type="number"
                    min="0"
                    placeholder="secs"
                    ng-model="$ctrl.subcommand.cooldown.global">
                <span class="input-group-addon">User</span>
                <input 
                    class="form-control"
                    type="number"
                    min="0"
                    placeholder="secs"
                    ng-model="$ctrl.subcommand.cooldown.user">
              </div>
            </div>

            <div>
              <div class="muted" style="font-weight:bold; font-size: 12px;">PERMISSIONS</div>
              <permission-options permission="$ctrl.subcommand.permission" hide-title="true"></permission-options>
            </div> 

          </div>
        </div>
      </div>
    `,
        controller: function() {
            let $ctrl = this;

            $ctrl.$onInit = function() {};

            $ctrl.getPermissionTooltip = (command, isSub) => {
                let type = command.permission ? command.permission.type : "";
                let cmdType = isSub ? "subcommand" : "command";
                switch (type) {
                case "group":
                    let groups = command.permission.groups;
                    if (groups == null || groups.length < 1) {
                        return `This ${cmdType} is set to Group permissions, but no groups are selected.`;
                    }
                    return `This ${cmdType} is restricted to the groups: ${command.permission.groups.join(
                        ", "
                    )}`;
                case "individual":
                    let username = command.permission.username;
                    if (username == null || username === "") {
                        return `This ${cmdType} is set to restrict to an individual but a name has not been provided.`;
                    }
                    return `This ${cmdType} is restricted to the user: ${username}`;
                default:
                    if (isSub) {
                        return `This ${cmdType} will use the permissions of the root command.`;
                    }
                    return `This ${cmdType} is available to everyone`;
                }
            };
        }
    });
}());
