export default {
	'src/**/*.ts': ['prettier --write', 'eslint --fix'],
	'tests/**/*.ts': ['prettier --write', 'eslint --fix'],
	'*.md': ['prettier --write'],
};
