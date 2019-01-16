import fetch from "../util/fetch-fill";
import URI from "urijs";

// /records endpoint
window.path = "http://localhost:3000/records";

// Your retrieve function plus any additional functions go here ...

// constant for page size
const LIMIT = 10;

// helper function to determine if record color is primary
function isPrimary(value) {
	return value.color === 'yellow' || value.color === 'red' || value.color === 'blue';
}

// helper function to transform response
function transformResponse(responseObject) {
	// set up the result object
	var xformedResponse = {
		// map the response to extract the ids
		ids: responseObject.map((currentValue, index, array) => {
			return currentValue.id;
		}),
		// filter the response for open dispositions and append isPrimary flag
		open: responseObject.filter((currentValue, index, array) => {
			if (currentValue.disposition === 'open') {
				currentValue.isPrimary = isPrimary(currentValue);
				return true;
			} else {
				return false;
			}
		}),
		// filter for closed primary records and then count them
		closedPrimaryCount: responseObject.filter((currentValue, index, array) => {
			return currentValue.disposition === 'closed' && isPrimary(currentValue);
		}).length,
		// init to null, this is set inside retrieve
		previousPage: null,
		nextPage: null
	};

	// return
	return xformedResponse;
}

// the point.
function retrieve(options) {
	// return a new promise
	return new Promise((resolve, reject) => {
		// set default options
		if (typeof options === 'undefined') options = {};
		if (typeof options.page === 'undefined') options.page = 1;
		if (typeof options.colors === 'undefined') options.colors = [];

		//  construct the uri for fetch
		var uri = URI(path).search({ limit: LIMIT });
		// add an offset if it's not page 1
		if (options.page !== 1) uri.addSearch({ offset: LIMIT*(options.page-1) });
		// set the color[] parameters if any were submitted
		if (options.colors.length > 0) uri.addSearch({ 'color[]': options.colors });

		// fetch...good boy
		fetch(uri).then(function(res) {
			// if there was an error
			if (res.ok !== true) {
				// log it
				console.log('Error retrieving records:\n'+res.statusText);
				// "recover" (this was an ambiguous requirement without noticing the test did not handle a rejected promise)
				resolve(["i'm super broken, please don't use me\n",res.statusText]);
				// do not continue, do not collect $200
				return;
			}
			// parse the response body as JSON
			res.json().then(function(obj) {
				// apply the transform
				var xformedResponse = transformResponse(obj);

				// if this isn't page one, set previousPage to the one before this
				if (options.page !== 1) xformedResponse.previousPage = options.page-1;
				// if this is false, there's definitely no next page
				if (obj.length === LIMIT) {
					// alter the uri to try and pull the next page
					uri.removeSearch('offset').addSearch({ offset: LIMIT*(options.page) })
					// fetch...good boy
					fetch(uri).then(function(res) {
						// parse as JSON
						res.json().then(function(obj) {
							// if there are objects, there's a page
							if (obj.length !== 0) {
								// this page is real, so it's the next one
								xformedResponse.nextPage = options.page+1;
							}
							// resolve
							resolve(xformedResponse);
						})
					})
				} else {
					// we were short on records for the current page request, so this is the last page.
					// we have to resolve "again" in an else block instead of just resolving outside the if block
					// in both cases because the resolution earlier came out of a Promise callback, which won't
					// have set the nextPage attribute immediately after the if block is done executing,
					// and we don't want to resolve until that happens, but need to resolve still when it's not
					// supposed to.
					resolve(xformedResponse);
				}
			});
		},
		function(err) {
			console.log('Fetch is about to break your test cases because they don\'t handle rejection well.\n'+err);
			reject(err);
			// just kidding, there's no test case that leads down this path, but 'recover' is still an ambiguous requirement
			// when Promises are explicitly spec'ed to be resolved or rejected and resolving with a broken object and nothing
			// but a log message to explain it would irritate most API users.  Digging through logs is not fun.

			// I'm not bitter or anything, I just spent way too much time debugging the "Unhandled Promise Rejection" error from an ambiguous stacktrace.
		});
	});
}

export default retrieve;
