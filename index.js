#!/usr/bin/env node

var PROGRAM_VERSION    = '0.1.0';

var fs = require('fs');
var path = require('path');
var program = require('commander');
var _ = require('lodash');

function TFCSpriteConverter(target, directory, prefix) {
  //targetとなるjsのfile
  var source = path.resolve(  process.cwd() + '/', target);
  //spriteのjsonが入っているfolder
  var sprites = path.resolve( process.cwd() + '/', directory);


  var data = fs.readFileSync(source, 'utf8');
  var files = fs.readdirSync(sprites);
  var jsons = [];

  //dataがなかったらerror
  if (!data) {
    throw new Error(source + ' is not exists');
  }

  if (!files) {
    throw new Error(sprite + ' is not exists');
  }

  jsons = _.filter(files, function(file) {
    return file.indexOf('.json') > 0;
  });

  if (jsons.length === 0) {
    throw new Error('json file is not exists in ' + sprites);
  }

  console.log(jsons);
  this.data = data;
  this.jsons = jsons;
  this.directory = directory;
  this.prefix = prefix;
  this.sprites = sprites;
}

TFCSpriteConverter.prototype.convert = function() {
  var data = this.data;
  var jsons = this.jsons;
  var sprites = this.sprites;
  var dir = this.directory;
  var prefix = this.prefix;

  var imageData = {};//sprite画像名をキーとして、spriteJsonの"frames"の中身を保持します
  var error;
  //read json

  _.each(jsons, function(file) {
    var jsonStr = fs.readFileSync(sprites + '/' + file, 'utf8');
    console.log("read " + file + "...");

    try{
      var json = JSON.parse(jsonStr.trim());
      imageData[json.meta.image] = json.frames;
    } catch(e) {
      console.log(e);
      console.log("jsonファイルがutf-8で保存されているか確認してください。");
      error = e;
      return;
    }
  });

  if(error) {
    return;
  }


  //spriteJsonの中から画像のデータ定義を取得
  var find = function(file) {
    var type = file.split('.')[1];
    if(type !== 'png') {
      console.log('WARNING: ' + file + ' がpngではないようです!');
      file = file.replace(type, 'png');//でもspriteJsonではキーがpngなってるはずなので置換
    }

    var key = file.split('.')[0];

    for (var prop in imageData) {
      var obj = imageData[prop];
      if(file in obj) {
        var value = obj[file]["frame"];
      } else if (key in obj) {
        //console.log('WARNING: ' + file + 'ライブラリに拡張子なしでおいてたやつ');
        var value = obj[key]["frame"];
      }

      if(value) {
        value.spriteName = prop.split('.')[0];
        return value;
      }

    }
    return null;
  };

  var images = {};//画像のidをキーにファイル名を保持

  //manifestを書き換えます
  data = data.replace(/lib.properties = \{([\r\n]|.)+?\};/g, function (libProperties) {
    //Sprite化の対象画像をmanifestから削除
    var reg = new RegExp('\{src:.+, id:\"' + prefix + '.+\"},?[/\r/\n]', 'mg');
    //libProperties = libProperties.replace(/\s+\{src:.+, id:\"_.+\"},?[\r\n]/g, function (manifest) {
    libProperties = libProperties.replace(reg, function (manifest, args) {
      var id = manifest.match(/id:\".+?\"/g, function(src){})[0].split('id:"').pop().replace('"', '');
      var filename = manifest.match(/src:\".+?\"/g, function(src){})[0].split('/').pop().replace('"', '');
      images[id] = filename;
      return '';
    });

    //Sprite画像をmanifestに追加
    libProperties = libProperties.replace(/manifest: \[/g, function (manifestHeader) {
      manifestHeader += '\n';
      for (var prop in imageData) {
        var str = '{src:"' + ('./' + dir + '/' + prop) + '", id:"' + prop.split('.')[0] + '"}';
        if ((new RegExp(str, "g")).test(libProperties) === false) {
          manifestHeader += str + ',\n';
        }
      }
      return manifestHeader;
    });

    //libPropertiesを整形
    libProperties = libProperties.replace(/\},[\r\n|\t]+\{/g, function(match) {
    	return '},\n{';
    });

    return libProperties;
  });


  //画像の定義部分を書き換えます,?
  var repCount = 0;

  //var reg = new RegExp('this.initialize\(img\.' + prefix + '.+?\);', 'g');
  var result = data.replace(/this.initialize\(img\._.+?\);/g, function (line) {
      repCount++;
      var key = line.replace('this.initialize(img.', '').replace(');', '');
     	var imgData = find(images[key]);
      
      if(!imgData) {
        throw new Error(key + 'is not exist in json data');
        return line;
      }
      var lineResult = line.replace(key, imgData.spriteName) + '\n' + 'this.sourceRect = {x:' + imgData.x + ', y:' + imgData.y + ', width:' + imgData.w + ', height:' + imgData.h + '};\n';
      return lineResult;
  });


  if (repCount === 0) {
    console.log('END: 変換対象画像はありません');
    return;
  }

  return result;
};



program
  .version(PROGRAM_VERSION)
  .usage('<file> [options]')
  .option('-o, --output <file>', 'convert file name. If empty, override target file')
  .option('-s, --sprites <directory>', 'sprite file json data directory, default is sprites', 'sprites')
  .option('-p, --prefix <prefix>', 'image name prefix, default is "_" ', '_')
  .parse(process.argv);

var target = program.args[0];

if (!target) {
  program.help();
  return console.log('should set javascript file name!');
}

if (program.output) console.log('  - output', program.output);
if (program.sprites) console.log('  - sprites', program.sprites);
if (program.sprites) console.log('  - prefix', program.prefix);
console.log('  - convert', target);

var tfcsprite = new TFCSpriteConverter(target, program.sprites, program.prefix);
var buffer = tfcsprite.convert();
var dest = program.output || target;

fs.writeFile(dest, buffer, {encoding: 'utf8'}, function(err) {
  if (err) {
    return console.log('failed to write converted source');
  }

  console.log('Success! converted file create ->', dest);
})