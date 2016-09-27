/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import path = require('path');
import fs = require('fs');

describe('Loc String Suite', function() {
	this.timeout(20000);

	before((done) => {
		// init here
		done();
	});

	after(function() {
		
	});
    
	it('Find invalid message key in task.json', (done) => {
		this.timeout(20000);
		
		// get all task.json and module.json paths.
		var tasksRootFolder =  path.resolve(__dirname, '../../../Tasks');
		var jsons: string[] = [];
		fs.readdirSync(tasksRootFolder).forEach(name => {
			let itemPath = path.join(tasksRootFolder, name);
			if (name == 'Common') {
				fs.readdirSync(itemPath).forEach(name => {
					let nestedItemPath = path.join(itemPath, name);
					if (fs.statSync(nestedItemPath).isDirectory()) {
						let moduleJsonPath = path.join(nestedItemPath, 'module.json');
						try {
							fs.statSync(moduleJsonPath);
						}
						catch (err) {
							return;
						}

						jsons.push(moduleJsonPath);
					}
				});
			}
			else if(fs.statSync(itemPath).isDirectory()) {
				jsons.push(path.join(itemPath, 'task.json'));
			}
		});

		for(var i = 0; i < jsons.length; i++) {
			var json = jsons[i];
			var obj = JSON.parse(fs.readFileSync(json).toString());
			if(obj.hasOwnProperty('messages')) {
				for(var key in obj.messages) {
					var jsonName = path.relative(tasksRootFolder, json);
					assert(key.search(/\W+/gi) < 0, ('(' + jsonName +')' + 'messages key: \'' + key +'\' contain non-word characters, only allows [a-zA-Z0-9_].'));
					if(typeof(obj.messages[key]) === 'object') {
						assert(obj.messages[key].loc, ('(' + jsonName +')' + 'messages key: \'' + key +'\' should have a loc string.'));
						assert(obj.messages[key].loc.toString().length >= 0, ('(' + jsonName +')' + 'messages key: \'' + key +'\' should have a loc string.'));
						assert(obj.messages[key].fallback, ('(' + jsonName +')' + 'messages key: \'' + key +'\' should have a fallback string.'));
						assert(obj.messages[key].fallback.toString().length > 0, ('(' + jsonName +')' + 'messages key: \'' + key +'\' should have a fallback string.'));
					}
					else if(typeof(obj.messages[key]) === 'string') {
						assert(obj.messages[key].toString().length > 0, ('(' + jsonName +')' + 'messages key: \'' + key +'\' should have a loc string.'));
					} 
        		}
			}
		}
		
		done();
	})
	
	it('Find missing string in .ts', (done: MochaDone) => {
		this.timeout(20000);
		
		// search the source dir for all task and module folders.
		let tasksPath =  path.resolve(__dirname, '../../../../Tasks');
		let taskPaths: string[] = [];
		fs.readdirSync(tasksPath).forEach((itemName: string) => {
			let itemPath = path.join(tasksPath, itemName);
			if (itemName != 'Common' && fs.statSync(itemPath).isDirectory()) { 
				taskPaths.push(itemPath);
			}
		});
		let commonPath = path.join(tasksPath, 'Common');
		fs.readdirSync(commonPath).forEach((itemName: string) => {
			let itemPath = path.join(commonPath, itemName);
			if (fs.statSync(itemPath).isDirectory()) { 
				taskPaths.push(itemPath);
			}
		});
		
		var testFailed: boolean = false;
		
		taskPaths.forEach((taskPath: string) => {
			var locStringMismatch: boolean = false;

			// load the task.json or module.json if exists
			let taskJson;
			for (let jsonName of [ 'task.json', 'module.json' ]) {
				let jsonPath = path.join(taskPath, jsonName);
				try {
					fs.statSync(jsonPath);
				}
				catch (err) {
					return;
				}

				taskJson = JSON.parse(fs.readFileSync(jsonPath).toString());
				break;
			}

			// recursively find all .ts files
			let tsFiles: string[] = [];
			let dirs: string[] = [ taskPath ];
			while (dirs.length) {
				let dir: string = dirs.pop();
				fs.readdirSync(dir).forEach((itemName: string) => {
					let itemPath: string = path.join(dir, itemName);
					if (fs.statSync(itemPath).isDirectory() && itemName != 'node_modules') {
						dirs.push(itemPath);
					}
					else if (itemName.search(/\.ts$/) > 0) {
						tsFiles.push(itemPath);
					}
				});
			}

			// search for all loc string keys
			let locStringKeys: string[] = [];
			tsFiles.forEach((tsFile: string) => {
				let content = fs.readFileSync(tsFile).toString().replace(/\r\n/g,'\n').replace(/\r/g,'\n');
				let lines: string[] = content.split('\n');
				lines.forEach(line => {
					// remove all spaces.
					line = line.replace(/ /g, '');
					
					let regx = /tl\.loc\(('(\w+)'|"(\w+)")/i;
					let res = regx.exec(line);
					if (res) {
						let key;
						if (res[2]) {
							key = res[2];
						}
						else if(res[3]) {
							key = res[3];
						}

						locStringKeys.push(key);
					}	
				});
			});

			// load the keys from the task.json/module.json
			let locStringKeysFromJson: string[] = [];
			if (taskJson && taskJson.hasOwnProperty('messages')) {
				Object.keys(taskJson.messages).forEach((key: string) => {
					locStringKeysFromJson.push(key);
				});
			}

			// find missing keys
			var missingLocStringKeys: string[] = [];
			locStringKeys.forEach((locKey: string) => {
				if (locStringKeysFromJson.indexOf(locKey) === -1 &&
					!locKey.match(/^LIB_/)) { // some tasks refernce lib strings

					locStringMismatch = true;
					missingLocStringKeys.push(locKey);
				}
			})

			if (locStringMismatch) {
				testFailed = true;
				console.error('add missing loc string keys to messages section for task.json/module.json: ' + path.relative(tasksPath, taskPath));
				console.error(JSON.stringify(missingLocStringKeys));
			}
		});
		
		assert(!testFailed, 'there are missing loc string keys in task.json/module.json.');
		
		done();
	})

    it('Find missing string in .ps1/.psm1', (done) => {
        this.timeout(20000);

        // Push all task folders onto the stack.
        var folders: string[] = [];
        var tasksRootFolder =  path.resolve(__dirname, '../../../Tasks');
        fs.readdirSync(tasksRootFolder).forEach(folderName => {
            var folder = path.join(tasksRootFolder, folderName);
            if (folderName != 'Common' && fs.statSync(folder).isDirectory()) {
                folders.push(folder);
            }
        })

        // Push each Common module folder onto the stack. The Common folder does not
        // get copied under _build so scan the source copy instead.
        var commonFolder = path.resolve(__dirname, "../../../../Tasks/Common");
        fs.readdirSync(commonFolder).forEach(folderName=> {
            var folder = path.join(commonFolder, folderName);
            if (fs.statSync(folder).isDirectory()) {
                folders.push(folder);
            }
        })

        folders.forEach(folder => {
            // Load the task.json or module.json if one exists.
            var jsonFile = path.join(folder, 'task.json');
            var obj = { "messages": { } }
            if (fs.existsSync(jsonFile) || fs.existsSync(jsonFile = path.join(folder, "module.json"))) {
                obj = JSON.parse(fs.readFileSync(jsonFile).toString());
            } else {
                jsonFile = ''
            }

            // Recursively find all PS files.
            var psFiles: string[] = [];
            var folderStack: string[] = [ folder ];
            while (folderStack.length > 0) {
                folder = folderStack.pop();
                if (path.basename(folder).toLowerCase() == "ps_modules") { continue } // Skip nested ps_modules folder.
                fs.readdirSync(folder).forEach(itemName => {
                    var itemPath = path.join(folder, itemName);
                    if (fs.statSync(itemPath).isDirectory()) {
                        folderStack.push(itemPath);
                    } else if (itemPath.toLowerCase().search(/\.ps1$/) > 0
                        || itemPath.toLowerCase().search(/\.psm1$/) > 0) {
                        psFiles.push(itemPath);
                    }
                })
            }

            psFiles.forEach(psFile => {
                var ps = fs.readFileSync(psFile).toString().replace(/\r\n/g,'\n').replace(/\r/g,'\n');
                var lines: string[] = ps.split('\n');
                lines.forEach(line => {
                    if (line.search(/Get-VstsLocString/i) > 0) {
                        var result = /Get-VstsLocString +-Key +('[^']+'|"[^"]+"|[^ )]+)/i.exec(line);
                        if (!result) {
                            assert(false, 'Bad format string in file ' + psFile + ' on line: ' + line);
                        }

                        var key = result[1].replace(/['"]/g, "");
                        assert(
                            obj.hasOwnProperty('messages') && obj.messages.hasOwnProperty(key),
                            "Loc resource key not found in task.json/module.json. Resource key: '" + key + "', PS file: '" + psFile + "', JSON file: '" + jsonFile + "'.");
                    }
                });
            })
        })
        done();
    })
});
