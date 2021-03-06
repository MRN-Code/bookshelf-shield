'use strict';

const thenifyAll = require('thenify-all');
const _ = require('lodash');

/**
 * loop through enumerable properties of obj
 * and store the keys of properties which are functions
 * and are not in the blacklist
 * @param {object} relations
 * @return {array} an array of keys
 */
function enumerateFunctions(relations) {
    const blacklist = [
        'use',
        'tearDown',
        'define'
    ];
    return _.reduce(relations, function(functions, prop, key) {
        if (blacklist.indexOf(key) === -1 && _.isFunction(prop)) {
            functions.push(key);
        }

        return functions;
    }, []);
}

/**
 * wrap relations object so that querying its context returns promises
 * @param {object} relations is a relations object
 * @return {object} the same relations object with wrapped context methods
 */
function wrap(relations) {
    return thenifyAll(relations, {}, enumerateFunctions(relations));
}

module.exports = wrap;
