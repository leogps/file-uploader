// compress files into tar.gz archive
require('targz').compress({
    src: 'dist/',
    dest: 'file-uploader.tar.gz'
}, function(err){
    if(err) {
        console.log(err);
    } else {
        console.log("Packaging done.");
    }
});