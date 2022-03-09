module.exports = {
	env: {
		browser: true,
		es2021: true,
		jest: true,
	},
	extends: [
		'airbnb-base',
	],
	parserOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module',
	},
	rules: {
		indent: ['warn', 'tab'],
		'no-tabs': 'off',

		semi: ['error', 'never'],
		'no-unexpected-multiline': 'error',
		'semi-style': ['error', 'first'],
		'no-extra-semi': 'error',

		'comma-dangle': ['warn', 'always-multiline'],
		'arrow-parens': ['warn', 'as-needed'],

		'no-console': 'off',
		'import/prefer-default-export': 'off',
		'max-classes-per-file': 'off',
		'no-plusplus': 'off',
		'no-minusminus': 'off',
		'max-len': ['error', 119],
		'no-param-reassign': 'warn',
	},
}
