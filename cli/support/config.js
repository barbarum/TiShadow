var path = require("path"),
    fs = require("fs"),
    colors = require("colors"),
    logger = require("../../server/logger"),
    base,
    home = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'],
    platforms = ['iphone','android','blackberry','mobileweb'],
    tiapp = require("tiapp"),
    config = {};

//get app name
function getAppName(callback) {
  tiapp.find(process.cwd(),function(err,result) {
    if (err) {
      logger.error("Script must be run within a Titanium project.");
      process.exit();
    }
    base = result.path; 
    callback(result.obj['ti:app']);
  });
}

//Default server setting
var config_path = path.join(home,'.tishadow.json');
if (fs.existsSync(config_path)) {
  config = require(config_path);
}

//Config setup
config.buildPaths = function(env, callback) {
  config.init(env);
  getAppName(function(result) {
    config.base = base;
    config.alloy_path        = path.join(base, 'app');
    config.resources_path    = path.join(base, 'Resources');
    config.modules_path      = path.join(base, 'modules');
    config.platform_path     = path.join(base, 'platform');
    config.spec_path         = path.join(base, 'spec');
    config.i18n_path         = path.join(base, 'i18n');
    config.build_path        = path.join(base, 'build');
    config.tishadow_build    = path.join(config.build_path, 'tishadow');
    config.tishadow_src      = path.join(config.tishadow_build, 'src');
    config.tishadow_spec     = path.join(config.tishadow_src, 'spec');
    config.tishadow_dist     = path.join(config.tishadow_build, 'dist');
    config.alloy_map_path    = path.join(config.tishadow_build, 'alloy_map.json');

    var app_name = config.app_name = result.name[0] || "bundle";
    config.bundle_file       = path.join(config.tishadow_dist, app_name + ".zip");
    config.jshint_path       = fs.existsSync(config.alloy_path) ? config.alloy_path : config.resources_path;
    if (config.isTiCaster && result.ticaster_user[0] && result.ticaster_app[0]) {
      config.room = result.ticaster_user[0] + ":" + result.ticaster_app[0];
    }
    if (config.room === undefined) {
      logger.error("ticaster setting missing from tiapp.xml");
      process.exit();
    }
    config.isAlloy = fs.existsSync(config.alloy_path);
    if (!config.platform && config.isAlloy) {
      var platform_folders = platforms
        .filter(function(platform) {
          return fs.existsSync(path.join(config.resources_path, platform, 'alloy', 'CFG.js'));
        })
      if (platform_folders.length === 1) {
        config.platform = platform_folders[0]
      } else { // alloy >= 1.3 uses platform folders for source code
        config.platform = platform_folders.sort(function(a,b) {
          return fs.statSync(path.join(config.resources_path, b, 'alloy.js')).mtime.getTime()
          - fs.statSync(path.join(config.resources_path, a,'alloy.js')).mtime.getTime()
        })[0];
      }
      config.platform = config.platform==="iphone" ? "ios": config.platform;
    }

    /** 
     * Set which platform to ignore so that extra bundle information is not created
     */
    if((config.platform === "iphone") || (config.platform === "ios")){
      config.ignore_path = path.join(config.resources_path + '/android');
      config.ignore_platform = "android";
    }
    else{
      config.ignore_path = path.join(config.resources_path + '/iphone');
      config.ignore_platform = "iphone";
    }
   //record the path for the scroller images (to exclude from the bundle)
   config.scroller_images = '/images/intro/';
   //record the location of the fonts for this build. They are copied seperately since the Titanium 3.2 update
   config.fonts_path        = path.join(config.resources_path + '/' + config.platform, 'fonts');
   console.log('****Fonts are: ' + config.fonts_path);
   console.log('****Ignore resources that are included in ' + config.ignore_path);
   console.log('****Ignore platform: ' + config.ignore_platform);


    config.last_updated_file = path.join(config.tishadow_build, 'last_updated' + (config.platform ? '_' + config.platform : ''));
    config.isPatch = env.patch;
    config.isUpdate = (env.update || env.patch) 
                    && fs.existsSync(config.tishadow_src)
                    && fs.existsSync(config.last_updated_file);

    callback();
  });
};


function getIPAddress() {
  var interfaces = require('os').networkInterfaces();
  for (var devName in interfaces) {
    var iface = interfaces[devName];

    for (var i = 0; i < iface.length; i++) {
      var alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
        return alias.address;
    }
  }

  return '0.0.0.0';
}

config.init = function(env) {
  config.isSpec     = env._name === "spec";
  config.isDeploy   = env._name === "deploy";
  config.isTailing  = env.tailLogs || config.isSpec;
  config.locale     = env.locale;
  config.isJUnit    = env.junitXml;
  config.isREPL     = env._name === "repl";
  config.isBundle   = env._name === "bundle";
  config.isTiCaster = env.ticaster;
  if (!env.ticaster) {
    config.host     = env.host || config.host || getIPAddress();
    config.port     = env.port || config.port || "3000";
    config.room     = env.room || config.room || "default";
    config.type     = env.type || config.type || "dev";
  } else {
    config.host     = "www.ticaster.io";
    config.port     = 443;
  }
  config.isHideShadow = env.hideshadow; 
  config.isShadowModulesIncluded = !env.excludeshadowmodules;
  config.timestamp = env.timestamp || Math.round(new Date().getTime()/1000);
  config.forceUpdate = env.forceUpdate;	
  config.screenshot_path = env.screenshotPath || "/tmp";
  config.internalIP = env.internalIp;
  config.isLongPolling = env.longPolling;
  config.isManageVersions = env.manageVersions;
  config.platform = env.platform;
  config.sourcebundlepath = env.sourcebundlepath;
  config.targetbundlepath = env.targetbundlepath;
  config.deltabundlepath = env.deltabundlepath;
};

config.write = function(env) {
  var new_config = {};
  if (fs.existsSync(config_path)) {
    new_config = require(config_path);
  }
  ['host','port','room'].forEach(function(param) {
    if (env[param] !== undefined) {
      new_config[param] = env[param];
    }
  });
  var config_text = JSON.stringify(new_config, null, 4);
  console.log(config_text.grey);
  console.log("TiShadow configuration file updated.");
  fs.writeFileSync(config_path, config_text);
};


module.exports = config;
