'use strict';

const AuthError = require('./error.js');
const _ = require('lodash');

/**
 * Iterate through rules and apply each one on the model and user
 * @param {array} rules is an array of Rule objects
 * @param {object} models is a bookshelf model instance
 * @param {object} user is the user credentials
 * @return {Promise} resolves to array of rule results,
 *   or rejects with AuthorizationError.
 */
function applyRules(rules, model, user) {
    const rulePromises = _.map(rules, (rule) => rule.applyTo(model, user));
    return Promise.all(rulePromises)

        //TODO validate rule results to handle optional vs. required auth...
        .catch(function catchAuthError(error) {
            return Promise.reject(error);
        });
}

/**
 * Fetch a record from DB, then verify permissions
 * @param {object} user is the user credentials
 * @param {object} options are options to be passed to destroy call
 * @return {Promise} resolves to fetch result or rejects with auth error
 */
function readSecure(user, options) {
    // jscs:disable
    // jshint -W040
    const self = this;
    // jshint +W040
    // jscs:enable
    const shield = self.constructor.shield;
    const action = 'read';
    const rules = shield.getApplicableRules(action);
    return shield._fetch.call(self, options)
        .then(function runShieldRules(result) {
            // TODO: investigate what happens if fetch returns nothing (err?)
            return applyRules(rules, self, user)
                .then(function resolveResult() {
                    return result;
                });
        });
}

/**
 * Fetch All records from DB, then verify permissions
 * @param {object} user is the user credentials
 * @param {object} options are options to be passed to destroy call
 * @return {Promise} resolves to fetchAll result or rejects with auth error
 */
function readAllSecure(user, options) {
    // jscs:disable
    // jshint -W040
    const self = this;
    // jshint +W040
    // jscs:enable
    const shield = self.constructor.shield;
    const action = 'read';
    const rules = shield.getApplicableRules(action);
    return shield._fetchAll.call(self, options)
        .then(function runShieldRules(collection) {
            // TODO: investigate what happens if fetch returns nothing (err?)
            return collection.mapThen((mdl) => applyRules(rules, mdl, user))
                .then(function resolveResult() {
                    return collection;
                });
        });
}

/**
 * Delete a record in the db after verifying privs
 * Permissions are validated against the current record in DB
 * @param {object} user is the user credentials
 * @param {object} options are options to be passed to destroy call
 * @return {Promise} resolves to destroy result or rejects with auth error
 */
function deleteSecure(user, options) {
    // jscs:disable
    // jshint -W040
    const self = this;
    // jshint +W040
    // jscs:enable
    const Model = self.constructor;
    const shield = Model.shield;
    const action = 'delete';
    const rules = shield.getApplicableRules(action);
    const primaryKey = Model.idAttribute;
    const query = {};
    const tmpModel = Model.forge(query);
    query[primaryKey] = self.get(primaryKey);
    return tmpModel.read(user)
        .then(function validateUpdatePrivs(originalModel) {
            // TODO: investigate what happens if fetch returns nothing (err?)
            return applyRules(rules, originalModel, user);
        }).then(function executeUpdate() {
            return shield._destroy.call(self, options);
        });
}

/**
 * update an existing record in DB after verifying privs
 * Permissions are validated against the current record in DB
 * @param {object} user is the user credentials
 * @param {object} options are options to be passed to save call
 * @return {Promise} resolves to save result or rejects with auth error
 */
function updateSecure(user, options) {
    // jscs:disable
    // jshint -W040
    const self = this;
    // jshint +W040
    // jscs:enable
    const Model = self.constructor;
    const shield = Model.shield;
    const action = 'update';
    const rules = shield.getApplicableRules(action);
    const primaryKey = Model.idAttribute;
    const query = {};
    const tmpModel = Model.forge(query);

    // validate that the model isNew
    if (self.isNew()) {
        return Promise.reject(
            new AuthError('attempt to update a new record')
        );
    }

    query[primaryKey] = self.get(primaryKey);
    return tmpModel.read(user)
        .then(function validateUpdatePrivs(originalModel) {
            // TODO: investigate what happens if fetch returns nothing (err?)
            return applyRules(rules, originalModel, user);
        }).then(function executeUpdate() {
            return shield._save.call(self, options);
        });
}

/**
 * create a new record in DB after verifying privs
 * @param {object} user is the user credentials
 * @param {object} options are options to be passed to save call
 * @return {Promise} resolves to save result or rejects with auth error
 */
function createSecure(user, options) {
    // jscs:disable
    // jshint -W040
    const self = this;
    // jshint +W040
    // jscs:enable
    let shield;
    let action;
    let rules;

    // validate that the model isNew
    if (!self.isNew()) {
        return Promise.reject(
            new AuthError('attempt to create a record that exists')
        );
    }

    // assign vars
    shield = self.constructor.shield;
    action = 'create';
    rules = shield.getApplicableRules(action);

    // run authorization, then perform save
    return applyRules(rules, self, user)
        .then(function executeSave() {
            return shield._save.call(self, options);
        });
}

/**
 * allows a protected method to be called
 * @param  {string} method   protected method to call
 * @param  {object} options  options to call function with
 * @return {Promise}         Promise that the called function returns
 */
function bypass(method, options) {
    // jscs:disable
    // jshint -W040
    const self = this;
    // jshint +W040
    // jscs:enable
    const shield = self.constructor.shield;

    if (!_.includes(shield.protectedMethods, method)) {
        return Promise.reject(new Error('no such protected method'));
    }
    const protectedMethod = `_${method}`;
    return shield[protectedMethod].call(self, options);
}

module.exports = {
    read: readSecure,
    readAll: readAllSecure,
    create: createSecure,
    update: updateSecure,
    delete: deleteSecure,
    bypass
};
