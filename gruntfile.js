module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		uglify: {
			options: {
				banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
			},
			build: {
				src: 'src/<%= pkg.name %>.js',
				dest: 'dist/<%= pkg.name %>.min.js'
			}
		},
		jshint: {
			files: ['src/morea.js'],
			options: {
				globals: {
					console: true,
					module: true,
					document: true
				}
			}
		},
		sass: {
			options: {
				outputStyle: 'compressed'
			},
			dist: {
				files: {
					'dist/morea.css': 'src/morea.scss'
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-sass');

	grunt.registerTask('default', ['uglify', 'sass:dist']);
	grunt.registerTask('test', ['jshint']);

};
