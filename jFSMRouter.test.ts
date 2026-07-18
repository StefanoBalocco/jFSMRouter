import test from 'ava';
import { JSDOM } from 'jsdom';
import type {
	FunctionOnEnter,
	FunctionOnLeave,
	FunctionOnTransitionAfter,
	FunctionOnTransitionBefore,
	CheckAvailability,
	RouteFunction
} from './jFSMRouter.js';

type Undefinedable<T> = T | undefined;
type Nullable<T> = T | null;
type RouteParams = { [ key: string ]: string };

interface Router {
	stateAdd( state: string ): boolean;
	stateDel( state: string ): boolean;
	readonly state: Undefinedable<string>;
	stateSet( nextState: string ): Promise<boolean>;
	checkTransition( nextState: string ): boolean;
	stateOnEnterAdd( state: string, func: FunctionOnEnter ): boolean;
	stateOnEnterDel( state: string, func: FunctionOnEnter ): boolean;
	stateOnLeaveAdd( state: string, func: FunctionOnLeave ): boolean;
	stateOnLeaveDel( state: string, func: FunctionOnLeave ): boolean;
	transitionAdd( from: string, to: string ): boolean;
	transitionDel( from: string, to: string ): boolean;
	transitionOnBeforeAdd( from: string, to: string, func: FunctionOnTransitionBefore ): boolean;
	transitionOnBeforeDel( from: string, to: string, func: FunctionOnTransitionBefore ): boolean;
	transitionOnAfterAdd( from: string, to: string, func: FunctionOnTransitionAfter ): boolean;
	transitionOnAfterDel( from: string, to: string, func: FunctionOnTransitionAfter ): boolean;
	routeSpecialAdd( code: number, routeFunction: RouteFunction ): boolean;
	routeAdd( validState: string, path: string, routeFunction: RouteFunction, available?: CheckAvailability, routeFunction403?: RouteFunction ): boolean;
	routeDel( path: string ): boolean;
	trigger( path: string ): void;
	route( path: string ): Promise<void>;
	checkHash(): Promise<void>;
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const dom: JSDOM = new JSDOM( '<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' } );

globalThis.document = dom.window.document;
globalThis.window = dom.window as Window & typeof globalThis;

const routerOriginal: Router = ( await import( './jFSMRouter.js' ) ).default as Router;
// @ts-expect-error jFSMRouter.min.js intentionally shares the original public API.
const routerMinified: Router = ( await import( './jFSMRouter.min.js' ) ).default as Router;

const targets: readonly { tag: string; router: Router; }[] = [
	{
		tag: '[jFSMRouter-original]',
		router: routerOriginal
	},
	{
		tag: '[jFSMRouter-minified]',
		router: routerMinified
	}
];

const cL1: number = targets.length;
for( let iL1: number = 0; iL1 < cL1; iL1++ ) {
	const target: { tag: string; router: Router; } = targets[ iL1 ];
	const tag: string = target.tag;
	const router: Router = target.router;
	let nameCounter: number = 0;

	function nextName( prefix: string ): string {
		return prefix + '_' + ( ++nameCounter );
	}

	async function moveToState( state: string ): Promise<void> {
		const currentState: Undefinedable<string> = router.state;
		router.stateAdd( state );
		if( ( undefined !== currentState ) && ( currentState !== state ) ) {
			router.transitionAdd( currentState, state );
			const changed: boolean = await router.stateSet( state );
			if( !changed ) {
				throw new Error( 'Failed to transition to state: ' + state );
			}
		}
	}

	test.serial( tag + ' Default export is a router instance', ( t ) => {
		t.is( typeof router, 'object' );
		t.truthy( router );
		t.truthy( router.stateAdd );
	} );

	test.serial( tag + ' stateAdd and initial state', ( t ) => {
		const stateName: string = nextName( 'initial' );
		t.true( router.stateAdd( stateName ) );
		t.is( router.state, stateName );
		t.false( router.stateAdd( stateName ) );
	} );

	test.serial( tag + ' State deletion removes inbound transitions', async ( t ) => {
		const fromState: string = nextName( 'del_from' );
		const toState: string = nextName( 'del_to' );
		await moveToState( fromState );
		router.stateAdd( toState );
		router.transitionAdd( fromState, toState );
		t.true( router.checkTransition( toState ) );
		t.true( router.stateDel( toState ) );
		t.false( router.checkTransition( toState ) );
		t.false( router.stateDel( toState ) );
	} );

	test.serial( tag + ' Transition add/delete booleans', async ( t ) => {
		const fromState: string = nextName( 'tadd_from' );
		const toState: string = nextName( 'tadd_to' );
		const missingState: string = nextName( 'tadd_missing' );
		await moveToState( fromState );
		router.stateAdd( toState );
		t.true( router.transitionAdd( fromState, toState ) );
		t.false( router.transitionAdd( fromState, toState ) );
		t.true( router.transitionDel( fromState, toState ) );
		t.false( router.transitionDel( fromState, toState ) );
		t.false( router.transitionAdd( fromState, missingState ) );
		t.false( router.transitionAdd( missingState, toState ) );
	} );

	test.serial( tag + ' stateSet hook order with async hooks', async ( t ) => {
		const fromState: string = nextName( 'hook_from' );
		const toState: string = nextName( 'hook_to' );
		const events: string[] = [];
		await moveToState( fromState );
		router.stateAdd( toState );
		router.transitionAdd( fromState, toState );
		router.transitionOnBeforeAdd( fromState, toState, () => {
			events.push( 'before' );
		} );
		router.stateOnLeaveAdd( fromState, async ( currentState: string, nextState: string ) => {
			events.push( 'leave:' + currentState + ':' + nextState );
		} );
		router.transitionOnAfterAdd( fromState, toState, () => {
			events.push( 'after' );
		} );
		router.stateOnEnterAdd( toState, async ( currentState: string, previousState: string ) => {
			events.push( 'enter:' + currentState + ':' + previousState );
		} );
		const result: boolean = await router.stateSet( toState );
		t.true( result );
		t.is( router.state, toState );
		t.deepEqual( events, [ 'before', 'leave:' + fromState + ':' + toState, 'after', 'enter:' + toState + ':' + fromState ] );
	} );

	test.serial( tag + ' OnBefore returning false aborts transition', async ( t ) => {
		const fromState: string = nextName( 'abort_from' );
		const toState: string = nextName( 'abort_to' );
		const events: string[] = [];
		await moveToState( fromState );
		router.stateAdd( toState );
		router.transitionAdd( fromState, toState );
		router.transitionOnBeforeAdd( fromState, toState, () => {
			events.push( 'before' );
			return false;
		} );
		router.stateOnLeaveAdd( fromState, () => {
			events.push( 'leave' );
		} );
		router.transitionOnAfterAdd( fromState, toState, () => {
			events.push( 'after' );
		} );
		router.stateOnEnterAdd( toState, () => {
			events.push( 'enter' );
		} );
		const result: boolean = await router.stateSet( toState );
		t.false( result );
		t.is( router.state, fromState );
		t.deepEqual( events, [ 'before' ] );
	} );

	test.serial( tag + ' Hook add/delete APIs dedupe and report missing states', ( t ) => {
		const existingState: string = nextName( 'hookdd' );
		const missingState: string = nextName( 'hookdd_missing' );
		router.stateAdd( existingState );
		const enterFn: FunctionOnEnter = (): void => { /* noop */ };
		const leaveFn: FunctionOnLeave = (): void => { /* noop */ };
		t.true( router.stateOnEnterAdd( existingState, enterFn ) );
		t.false( router.stateOnEnterAdd( existingState, enterFn ) );
		t.true( router.stateOnEnterDel( existingState, enterFn ) );
		t.false( router.stateOnEnterDel( existingState, enterFn ) );
		t.true( router.stateOnLeaveAdd( existingState, leaveFn ) );
		t.false( router.stateOnLeaveAdd( existingState, leaveFn ) );
		t.true( router.stateOnLeaveDel( existingState, leaveFn ) );
		t.false( router.stateOnLeaveDel( existingState, leaveFn ) );
		t.false( router.stateOnEnterAdd( missingState, enterFn ) );
		t.false( router.stateOnEnterDel( missingState, enterFn ) );
		t.false( router.stateOnLeaveAdd( missingState, leaveFn ) );
		t.false( router.stateOnLeaveDel( missingState, leaveFn ) );
	} );

	test.serial( tag + ' Transition hook add/delete APIs report booleans', async ( t ) => {
		const fromState: string = nextName( 'thook_from' );
		const toState: string = nextName( 'thook_to' );
		const missingState: string = nextName( 'thook_missing' );
		await moveToState( fromState );
		router.stateAdd( toState );
		router.transitionAdd( fromState, toState );
		const beforeFn: FunctionOnTransitionBefore = (): void => { /* noop */ };
		const afterFn: FunctionOnTransitionAfter = (): void => { /* noop */ };
		t.true( router.transitionOnBeforeAdd( fromState, toState, beforeFn ) );
		t.true( router.transitionOnBeforeDel( fromState, toState, beforeFn ) );
		t.false( router.transitionOnBeforeDel( fromState, toState, beforeFn ) );
		t.true( router.transitionOnAfterAdd( fromState, toState, afterFn ) );
		t.true( router.transitionOnAfterDel( fromState, toState, afterFn ) );
		t.false( router.transitionOnAfterDel( fromState, toState, afterFn ) );
		t.false( router.transitionOnBeforeAdd( fromState, missingState, beforeFn ) );
		t.false( router.transitionOnBeforeDel( fromState, missingState, beforeFn ) );
	} );

	test.serial( tag + ' No match with no 404 falls back to 500', async ( t ) => {
		let errorHandlerCalled: number = 0;
		router.routeSpecialAdd( 500, () => {
			errorHandlerCalled++;
		} );
		await router.route( '/nomatch-' + nextName( 'nofallback' ) );
		t.is( errorHandlerCalled, 1 );
	} );

	test.serial( tag + ' routeAdd captures typed params and dispatches route function', async ( t ) => {
		const stateName: string = nextName( 'params' );
		let callCount: number = 0;
		let capturedPath: string = '';
		let capturedHashPath: string = '';
		let capturedParams: Nullable<RouteParams> = null;
		await moveToState( stateName );
		router.routeAdd( stateName, '/params-' + stateName + '/:id[09]/:slug[AZ]', ( path: string, hashPath: string, params?: RouteParams ) => {
			callCount++;
			capturedPath = path;
			capturedHashPath = hashPath;
			capturedParams = params ?? null;
		} );
		await router.route( '/params-' + stateName + '/123/ABC' );
		t.is( callCount, 1 );
		t.is( capturedPath, '/params-' + stateName + '/:09/:AZ' );
		t.is( capturedHashPath, '/params-' + stateName + '/123/ABC' );
		t.deepEqual( capturedParams, { id: '123', slug: 'ABC' } );
	} );

	test.serial( tag + ' Route constraints reject non-matching params and call 404', async ( t ) => {
		const stateName: string = nextName( 'constraint' );
		let routeCalled: number = 0;
		let notFoundCalled: number = 0;
		await moveToState( stateName );
		router.routeAdd( stateName, '/numeric-' + stateName + '/:id[09]', () => {
			routeCalled++;
		} );
		router.routeSpecialAdd( 404, () => {
			notFoundCalled++;
		} );
		await router.route( '/numeric-' + stateName + '/abc' );
		t.is( routeCalled, 0 );
		t.is( notFoundCalled, 1 );
	} );

	test.serial( tag + ' Static route wins over variable route', async ( t ) => {
		const stateName: string = nextName( 'priority' );
		let variableCalled: number = 0;
		let staticCalled: number = 0;
		await moveToState( stateName );
		router.routeAdd( stateName, '/priority-' + stateName + '/:id[AZ09]', () => {
			variableCalled++;
		} );
		router.routeAdd( stateName, '/priority-' + stateName + '/profile', () => {
			staticCalled++;
		} );
		await router.route( '/priority-' + stateName + '/profile' );
		t.is( variableCalled, 0 );
		t.is( staticCalled, 1 );
	} );

	test.serial( tag + ' Equivalent route definitions are rejected and deletable', async ( t ) => {
		const stateName: string = nextName( 'equiv' );
		await moveToState( stateName );
		t.true( router.routeAdd( stateName, '/equiv-' + stateName + '/:id[AZ09]', () => { /* noop */ } ) );
		t.false( router.routeAdd( stateName, '/equiv-' + stateName + '/:name[AZ]', () => { /* noop */ } ) );
		t.true( router.routeDel( '/equiv-' + stateName + '/:code[09]' ) );
		t.false( router.routeDel( '/equiv-' + stateName + '/:code[09]' ) );
	} );

	test.serial( tag + ' routeAdd throws for invalid definitions', ( t ) => {
		const missingState: string = nextName( 'throw_missing' );
		t.throws( () => {
			router.routeAdd( missingState, '/throw-' + missingState, () => { /* noop */ } );
		}, { instanceOf: SyntaxError, message: 'Non-existent state' } );
		const stateName: string = nextName( 'throw_dup' );
		router.stateAdd( stateName );
		t.throws( () => {
			router.routeAdd( stateName, '/duplicate-' + stateName + '/:id/path/:id', () => { /* noop */ } );
		}, { instanceOf: SyntaxError, message: 'Duplicate path id' } );
	} );

	test.serial( tag + ' Availability false uses route-specific 403 before global 403', async ( t ) => {
		const stateName: string = nextName( 'spec403' );
		let specificForbidden: number = 0;
		let globalForbidden: number = 0;
		let normalRoute: number = 0;
		await moveToState( stateName );
		router.routeSpecialAdd( 403, () => {
			globalForbidden++;
		} );
		router.routeAdd(
			stateName,
			'/spec403-' + stateName,
			() => {
				normalRoute++;
			},
			() => {
				return false;
			},
			() => {
				specificForbidden++;
			}
		);
		await router.route( '/spec403-' + stateName );
		t.is( specificForbidden, 1 );
		t.is( globalForbidden, 0 );
		t.is( normalRoute, 0 );
	} );

	test.serial( tag + ' Availability false falls back to global 403', async ( t ) => {
		const stateName: string = nextName( 'glob403' );
		let globalForbidden: number = 0;
		let normalRoute: number = 0;
		await moveToState( stateName );
		router.routeSpecialAdd( 403, () => {
			globalForbidden++;
		} );
		router.routeAdd(
			stateName,
			'/glob403-' + stateName,
			() => {
				normalRoute++;
			},
			() => {
				return false;
			}
		);
		await router.route( '/glob403-' + stateName );
		t.is( globalForbidden, 1 );
		t.is( normalRoute, 0 );
	} );

	test.serial( tag + ' Async availability true dispatches normal route function', async ( t ) => {
		const stateName: string = nextName( 'asyncavail' );
		let routeCalled: number = 0;
		await moveToState( stateName );
		router.routeAdd(
			stateName,
			'/asyncavail-' + stateName,
			() => {
				routeCalled++;
			},
			async () => {
				return true;
			}
		);
		await router.route( '/asyncavail-' + stateName );
		t.is( routeCalled, 1 );
	} );

	test.serial( tag + ' Valid-state mismatch uses 500 handler', async ( t ) => {
		const currentState: string = nextName( 'vs_current' );
		const requiredState: string = nextName( 'vs_required' );
		let errorHandlerCalled: number = 0;
		let routeCalled: number = 0;
		await moveToState( currentState );
		router.stateAdd( requiredState );
		router.routeSpecialAdd( 500, () => {
			errorHandlerCalled++;
		} );
		router.routeAdd( requiredState, '/valstate-' + requiredState, () => {
			routeCalled++;
		} );
		await router.route( '/valstate-' + requiredState );
		t.is( errorHandlerCalled, 1 );
		t.is( routeCalled, 0 );
	} );

	test.serial( tag + ' No route match uses 404 handler', async ( t ) => {
		let notFoundCalled: number = 0;
		router.routeSpecialAdd( 404, () => {
			notFoundCalled++;
		} );
		await router.route( '/unmatched-' + nextName( '404' ) );
		t.is( notFoundCalled, 1 );
	} );

	test.serial( tag + ' routeSpecialAdd rejects unsupported status codes', ( t ) => {
		t.throws( () => {
			router.routeSpecialAdd( 418, () => { /* noop */ } );
		}, { instanceOf: RangeError } );
	} );

	test.serial( tag + ' trigger sets hash and checkHash dispatches current hash', async ( t ) => {
		const stateName: string = nextName( 'hashroute' );
		let routeCalls: number = 0;
		await moveToState( stateName );
		router.routeAdd( stateName, '/hash-' + stateName, () => {
			routeCalls++;
		} );
		router.trigger( '/hash-' + stateName );
		t.is( dom.window.location.hash, '#/hash-' + stateName );
		await router.checkHash();
		t.true( 0 < routeCalls );
	} );

	test.serial( tag + ' Routing queue drains hash changes during active routing', async ( t ) => {
		const stateName: string = nextName( 'queue' );
		const events: string[] = [];
		await moveToState( stateName );
		router.routeAdd( stateName, '/queue-' + stateName + '/first', async () => {
			events.push( 'first' );
			dom.window.location.hash = '#/queue-' + stateName + '/second';
			await router.checkHash();
		} );
		router.routeAdd( stateName, '/queue-' + stateName + '/second', () => {
			events.push( 'second' );
		} );
		await router.route( '/queue-' + stateName + '/first' );
		t.deepEqual( events, [ 'first', 'second' ] );
	} );

	test.serial( tag + ' stateSet reentrancy guard rejects nested transition', async ( t ) => {
		const fromState: string = nextName( 're_from' );
		const toState: string = nextName( 're_to' );
		const otherState: string = nextName( 're_other' );
		let nestedResult: boolean = false;
		await moveToState( fromState );
		router.stateAdd( toState );
		router.stateAdd( otherState );
		router.transitionAdd( fromState, toState );
		router.transitionAdd( fromState, otherState );
		router.transitionOnBeforeAdd( fromState, toState, async () => {
			nestedResult = await router.stateSet( otherState );
		} );
		const outerResult: boolean = await router.stateSet( toState );
		t.true( outerResult );
		t.false( nestedResult );
		t.is( router.state, toState );
	} );

	test.serial( tag + ' All hook sync/async variants', async ( t ) => {
		const fromState: string = nextName( 'syncasync_from' );
		const toState: string = nextName( 'syncasync_to' );
		const events: string[] = [];
		await moveToState( fromState );
		router.stateAdd( toState );
		router.transitionAdd( fromState, toState );
		router.transitionOnAfterAdd( fromState, toState, async () => {
			events.push( 'after:async' );
		} );
		router.stateOnLeaveAdd( fromState, ( currentState: string, nextState: string ) => {
			events.push( 'leave:sync:' + currentState + ':' + nextState );
		} );
		router.stateOnEnterAdd( toState, ( currentState: string, previousState: string ) => {
			events.push( 'enter:sync:' + currentState + ':' + previousState );
		} );
		const result: boolean = await router.stateSet( toState );
		t.true( result );
		t.is( router.state, toState );
		t.deepEqual( events, [
			'leave:sync:' + fromState + ':' + toState,
			'after:async',
			'enter:sync:' + toState + ':' + fromState
		] );
	} );

	test.serial( tag + ' routeDel throws on duplicate path id', ( t ) => {
		t.throws( () => {
			router.routeDel( '/dupdel-' + nextName( 'dupdel' ) + '/:id/path/:id' );
		}, { instanceOf: SyntaxError, message: 'Duplicate path id' } );
	} );

	test.serial( tag + ' Route with untyped param defaults to AZ09', async ( t ) => {
		const stateName: string = nextName( 'untyped' );
		let callCount: number = 0;
		let capturedParams: Nullable<RouteParams> = null;
		await moveToState( stateName );
		router.routeAdd( stateName, '/untyped-' + stateName + '/:name', ( _path: string, _hashPath: string, params?: RouteParams ) => {
			callCount++;
			capturedParams = params ?? null;
		} );
		await router.route( '/untyped-' + stateName + '/hello123' );
		t.is( callCount, 1 );
		t.deepEqual( capturedParams, { name: 'hello123' } );
	} );

	test.serial( tag + ' routeDel with untyped param', async ( t ) => {
		const stateName: string = nextName( 'untypeddel' );
		await moveToState( stateName );
		t.true( router.routeAdd( stateName, '/untypeddel-' + stateName + '/:name', () => { /* noop */ } ) );
		t.true( router.routeDel( '/untypeddel-' + stateName + '/:name' ) );
	} );

	test.serial( tag + ' Non-function available triggers 403', async ( t ) => {
		const stateName: string = nextName( 'nonfn' );
		let forbiddenCalled: number = 0;
		let routeCalled: number = 0;
		await moveToState( stateName );
		router.routeSpecialAdd( 403, () => {
			forbiddenCalled++;
		} );
		router.routeAdd(
			stateName,
			'/nonfn-' + stateName,
			() => {
				routeCalled++;
			},
			'not-a-function' as unknown as CheckAvailability
		);
		await router.route( '/nonfn-' + stateName );
		t.is( forbiddenCalled, 1 );
		t.is( routeCalled, 0 );
	} );
}
