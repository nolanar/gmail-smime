// Rollup plugins
import eslint from 'rollup-plugin-eslint';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

export default {
	entry: 'src/app.js',
	dest: 'build/js/app.min.js',
	format: 'iife',
	sourceMap: 'inline',
	plugins: [
		resolve({
			jsnext: true,
			main: true,
			browser: true,
		}),
		commonjs(),
		eslint({
			exclude: [
				'lib/**',
			]
		}),
	],
};
