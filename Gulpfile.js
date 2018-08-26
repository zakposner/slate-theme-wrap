const gulp          = require('gulp');
const clean         = require('gulp-clean');
const watch         = require('gulp-watch');
const recursive     = require("recursive-readdir");
const mkdirp        = require('mkdirp');
const runSequence   = require('run-sequence');
const c             = require('ansi-colors');
const path          = require('path');
const fs            = require('fs');
let { exec, spawn } = require('child_process');

// Command Line arg
let theme;
if ( process.argv.length > 3 ) {
    theme = process.argv[3].replace('--', '');
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//  Logging Functions
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const successLog = message => console.log(c.green('[Accelerate] ' + message));

const errorLog = message => console.log(c.red('[Accelerate] ' + message));

const infoLog = message => console.log(c.yellow('[Accelerate] ' + message));

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//  File Processing Functions
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function isHiddenFile(file, stats) {
    return (/(^|\/)\.[^\/\.]/g).test(file);
}

function copyFile(source, target, cb) {
    let cbCalled = false;
  
    let rd = fs.createReadStream(source);
    rd.on("error", function(err) { done(err);});

    let wr = fs.createWriteStream(target);
    wr.on("error", function(err) { done(err); });
    wr.on("close", function(ex) { done(); });

    rd.pipe(wr);
  
    function done(err) {
        if (!cbCalled) {
            if (err) {
                errorLog(`File Create Error: ${err}`);
                if (cb) {
                    cb(err);
                    cbCalled = true;
                }
            }
        }
    }
}

function overwriteBuildFile(file, replaceString) {
    // Get respective path in Build folder                
    const buildFile = file.replace(replaceString, '/build/src/');
    const buildPath = path.dirname(buildFile);

    // If the override file's path does not exist in Build, create it
    if ( !fs.existsSync(buildPath) ) {
        mkdirp(buildPath)
    }

    // If the file exists in build, overwrite it
    // Otherwise, create it in build
    copyFile(file, buildFile);
}

function removeFile(path) {
    fs.unlinkSync(path);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//  Paths
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const paths = {
    build: path.resolve(__dirname, 'build/src'),
    core: path.resolve(__dirname, 'core'),
    instance: path.resolve(__dirname, 'instance')
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//  Build Tasks
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

/**
 * Remove everything from /build/src
 */
gulp.task('clean', () => {
    return gulp
            .src(paths.build + '/*', { read: false })
            .pipe( clean() );
})

/**
 * Build the core theme files
 */
gulp.task('build:core', () => {
    return gulp
            .src(paths.core + '**/**', { base: 'core' })
            .pipe( gulp.dest('build/src') );
});

/**
 * Process the instance-specific theme files
 */
gulp.task('build:instance', () => {

    // Pull all override files from instance
    const filesRecursive = recursive(paths.instance, [isHiddenFile], function(err, files) {
        // Only proceed if we actually have override files to process
        if (!files.length) {
            return;
        }
        if (err) {
            errorLog(`Build Error: ${err}`);
        }
        // Loop through & process each override file
        files.forEach( file => overwriteBuildFile(file, '/instance/') );
    });

});

/**
 * Run all build tasks
 */
gulp.task('build:theme', () => {
    runSequence('clean','build:core',`build:instance`);
});

/**
 * Watch files for changes and update the build
 */
gulp.task('watch:files', () => {

    // Watch all core and instance files
    let fileWatcher = watch([
        path.resolve( paths.core + '/**/**' ), 
        path.resolve( paths.instance + '/**/**' )
    ]);
            
    // -=-=- When new file added -=-=-
    fileWatcher.on('add', (filePath, stats) => {

        let replaceString = '/instance/';
        let isCoreFile = false;

        // if it was a core file
        if ( filePath.indexOf( paths.core ) !== -1 ) {
            replaceString = '/core/';
            isCoreFile = true;
        }

        const buildFile = filePath.replace(replaceString, '/build/src/');

        // If core file, check if there is an override for it
        if (isCoreFile) {
            let overridePath = filePath.replace(replaceString, `/instance/`);
            // if theres an override file, we're done here
            if ( fs.existsSync(overridePath) ) {
                infoLog(`Not adding ${c.blue(path.basename(filePath))} to build because an override file exists`)
                return;
            }
        }

        successLog(`Adding file ${c.blue(path.basename(filePath))} to the build`)
        overwriteBuildFile(filePath, replaceString);
    });

    // -=-=- When file removed -=-=-
    fileWatcher.on('unlink', (filePath, stats) => {

        let replaceString = `/instance/`;
        let isCoreFile = false;

        // if it was a core file
        if ( filePath.indexOf( paths.core ) !== -1 ) {
            replaceString = '/core/';
            isCoreFile = true;
        }

        const buildFile = filePath.replace(replaceString, '/build/src/');

        // If core file, check if there is an override for it
        if (isCoreFile) {
            let overridePath = filePath.replace(replaceString, `/instance/`);
            // if theres an override file, we're done here
            if ( fs.existsSync(overridePath) ) {
                infoLog(`Not removing ${c.blue(path.basename(filePath))} from build because an override file exists`);
                return;
            }
        }

        successLog(`Removing file ${c.blue(path.basename(filePath))} from the build`);
        removeFile(buildFile);
    });

    // -=-=- When any file is saved -=-=-
    fileWatcher.on('change', (filePath, stats) => {

        let replaceString = `/instance/`;
        let isCoreFile = false;

        // if it was a core file
        if ( filePath.indexOf( paths.core ) !== -1 ) {
            replaceString = '/core/';
            isCoreFile = true;
        }

        const buildFile = filePath.replace(replaceString, '/build/src/');

        // If core file, check if there is an override for it
        if (isCoreFile) {
            let overridePath = filePath.replace(replaceString, `/instance/`);
            // if theres an override file, we're done here
            if ( fs.existsSync(overridePath) ) {
                infoLog(`Not saving changes to core file ${c.blue(path.basename(filePath))} because an override file exists`);
                return;
            }
        }

        // Overwrite the file
        successLog(`Saving changes to file ${c.blue(path.basename(filePath))}`);
        overwriteBuildFile(filePath, replaceString);
    });

});

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//  Deploy Tasks
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

/**
 * Deploy to deploy the theme to the store
 */
gulp.task('slate:deploy', () => {
    const childProcess = exec(`slate deploy -e --${theme}`, { cwd: paths.build });

    // error handling
    childProcess.on('error', data => errorLog(`Error with Slate deploy: ${data}`) );

    // data handling
    childProcess.stdout.on('data', data => process.stdout.write(data) );
});

/**
 * Deploy the theme to the store, then watch files
 */
gulp.task('slate:start', () => {
    const childProcess = exec(`npm run ${theme}`, { cwd: paths.build });

    // error handling
    childProcess.on('error', data => errorLog(`Error with Slate deploy: ${data}`) );

    // data handling
    childProcess.stdout.on('data', data => process.stdout.write(data) );
});

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//  Top Level Tasks
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

gulp.task('watch', () => {
    runSequence('build:theme','watch:files','slate:start');
});

gulp.task('build', () => {
    runSequence('build:theme','slate:deploy');
});
