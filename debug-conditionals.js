import { extractConditionals } from './src/xpath/extractors/extractConditionals.js';

console.log('Test 1 - Multiple conditions:');
const xpath1 = "//Method[not(@Static) and @Visibility='public' or @Name='test']";
console.log('XPath:', xpath1);
console.log('Result:', JSON.stringify(extractConditionals(xpath1), null, 2));

console.log('\nTest 2 - Complex expressions:');
const xpath2 = "//Method[not(contains(@Name, 'test'))]";
console.log('XPath:', xpath2);
console.log('Result:', JSON.stringify(extractConditionals(xpath2), null, 2));

console.log('\nTest 3 - Nested conditions:');
const xpath3 = "//Method[not(@Static and @Final)]";
console.log('XPath:', xpath3);
console.log('Result:', JSON.stringify(extractConditionals(xpath3), null, 2));

console.log('\nTest 4 - Let expressions:');
const xpath4 = "let $methods := //Method return $methods[not(@Static) and @Visibility='public']";
console.log('XPath:', xpath4);
console.log('Result:', JSON.stringify(extractConditionals(xpath4), null, 2));
