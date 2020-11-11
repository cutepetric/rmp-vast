module.exports = {
  main: {
    options: {
      archive: '../../../backup/rmp-vast/rmp-vast-<%= package.version %>.zip'
    },
    files: [{
      expand: true,
      src: [
        'app/**',
        'css/**',
        'externals/**',
        'grunt/**',
        'js/**',
        'test/**',
        'vast-client-js/**',
        '.*',
        '*.js',
        'LICENSE',
        '*.json',
        '*.html'
      ]
    }]
  }
};
