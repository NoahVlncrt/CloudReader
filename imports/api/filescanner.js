import { Meteor } from 'meteor/meteor';
var fs = require("fs");
var unzip = require("unzip");
var Unrar = require("unrar");

import Series from '/imports/api/collections/Series.js';
import Issue from '/imports/api/collections/Issue.js';


const AllComics = Meteor.settings.private.pathtocomics;

const comicSeries = []

const basePath = process.env.PWD

const extensionSearch = /\.cbr|\.cbz/

const getSeriesCoverZip = function(zip, ogfile, type, index2) {
    let counter = 0
    fs.createReadStream(zip)
        .pipe(unzip.Parse())
        .on('entry', function(entry) {
            filename = entry.path;
            if (entry.type === 'File') {
                if (counter < 1) {
                    if (type === "later") {
                        fs.stat(basePath + "/public/covers/" + ogfile + "/" + "cover_0.jpg", function(err, stat) {
                            if (err == null) {
                                fs.unlink(basePath + "/public/covers/" + ogfile + "/" + "cover_0.jpg", (err) => {
                                    if (err) throw err;
                                    stream.pipe(fs.createWriteStream(basePath + "/public/covers/" + ogfile + "/" + "cover_" + index2 + ".jpg"))
                                });
                            } else {
                                stream.pipe(fs.createWriteStream(basePath + "/public/covers/" + ogfile + "/" + "cover_" + index2 + ".jpg"))
                            }
                        })
                    } else {
                        entry.pipe(fs.createWriteStream(basePath + "/public/covers/" + ogfile + "/" + "cover_0.jpg"))
                    }
                    counter = +1
                } else {
                    entry.autodrain()
                }
            } else {
                entry.autodrain();
            }
        })
}

const getSeriesCoverRar = function(zip, ogfile, type, index2) {
    let counter = 0
    let archive = new Unrar(zip);
    archive.list(function(err, entries) {
        entries.forEach(function(entry, index) {
            if (entry.type === 'File') {
                if (/(000.jpg)|(001.jpg)|(00a.jpg)/.test(entry.name) && counter < 1) {
                    let stream = archive.stream(entry.name)
                    stream.on('error', console.error)
                    if (type === "later") {
                        fs.stat(basePath + "/public/covers/" + ogfile + "/" + "cover_0.jpg", function(err, stat) {
                            if (err == null) {
                                fs.unlink(basePath + "/public/covers/" + ogfile + "/" + "cover_0.jpg", (err) => {
                                    if (err) throw err;
                                    stream.pipe(fs.createWriteStream(basePath + "/public/covers/" + ogfile + "/" + "cover_" + index2 + ".jpg"))
                                });
                            } else {
                                stream.pipe(fs.createWriteStream(basePath + "/public/covers/" + ogfile + "/" + "cover_" + index2 + ".jpg"))
                            }
                        })
                    } else {
                        stream.pipe(fs.createWriteStream(basePath + "/public/covers/" + ogfile + "/" + "cover_0.jpg"))
                    }
                    counter = +1
                }
            }
        })
    })
}


//scans the directory passed to it, cleans up all filenames, checks extensions, and adds them to issue
const PopulateCovers = function(filepath, ogfile) {
    const seriesId = Series.findOne({ path: filepath })._id
    fs.readdir(filepath, Meteor.bindEnvironment(function(err, files) {
        fs.mkdir(basePath + "/public/covers/" + ogfile)

        if (/\.cbz/.test(filepath + "/" + files[0])) {
            console.log("unzipping" + ogfile + " to server")
            getSeriesCoverZip(filepath + "/" + files[0], ogfile, "initial")
        }

        if (/\.cbr/.test(filepath + "/" + files[0])) {
            console.log("unrarring?" + ogfile + " to server")
            getSeriesCoverRar(filepath + "/" + files[0], ogfile, "initial")
        }

        files.forEach(function(file, index) {
            var currentDirectory = filepath + "/" + file //complete path to zip file 'directory/place/item.zip' etc...
            if (file.match(extensionSearch)) {
                const filename = file.split(extensionSearch)
                if (!Issue.findOne({ filepath: currentDirectory })) {
                    Issue.insert({ name: filename[0], filepath: currentDirectory, parentSeries: seriesId, number: index })
                }
            }

        })
    }))
}

const PopulateIssues = function(files, seriesname) {

    files.forEach(function(file, index) {
        if (/\.cbz/.test(file.filepath)) {
            console.log("unzipping " + file.name + " to server")
            getSeriesCoverZip(file.filepath, seriesname, "later", index)
        }

        if (/\.cbr/.test(file.filepath)) {
            console.log("unrarring " + file.name + " to server")
            getSeriesCoverRar(file.filepath, seriesname, "later", index)
        }

    })
}

//scans entire directory specified by the user in the settings and returns all the folders
const ReadComicDirectory = function() {
    if (!AllComics) {
        return "There doesn't seem to be anything here :("
    }
    fs.readdir(AllComics, Meteor.bindEnvironment((function(err, files) {
        files.forEach(file => {
            const ogfile = file
            const newfile = AllComics + file
            fs.stat(newfile, Meteor.bindEnvironment(function(err, stats) {
                if (stats.isDirectory()) {
                    if (!Series.findOne({ path: newfile })) {
                        Series.insert({ name: ogfile, path: newfile, cover: "/covers/" + ogfile + "/cover_0.jpg" })
                        PopulateCovers(newfile, ogfile)
                    }
                }
            }))
        })
    })))
}

export { ReadComicDirectory, PopulateIssues }