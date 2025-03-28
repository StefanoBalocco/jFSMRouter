'use strict';

export type FunctionOnEnter = ( currentState: string, nextState: string ) => ( void | Promise<void> );
export type FunctionOnLeave = ( currentState: string, prevState: string ) => ( void | Promise<void> );
export type FunctionOnTransitionAfter = () => ( void | Promise<void> );
export type FunctionOnTransitionBefore = () => ( any | Promise<any> );
export type CheckAvailability = ( path: string, hashPath: string, params?: { [ key: string ]: string } ) => ( boolean | Promise<boolean> );
export type RouteFunction = ( path: string, hashPath: string, params?: { [ key: string ]: string } ) => ( void | Promise<void> );
type Route = {
	path: string,
	validState: string,
	match: RegExp,
	weight: number,
	routeFunction: RouteFunction,
	available?: CheckAvailability,
	routeFunction403?: RouteFunction
};

export default class jFSMRouter {
	public static Create( initialState: string ): jFSMRouter {
		return new jFSMRouter( initialState );
	}
	private _regexDuplicatePathId = new RegExp( /\/(:\w+)(?:\[(?:09|AZ|AZ09)])?\/(?:.+\/)?(\1)(?:\[(?:09|AZ|AZ09)])?(?:\/|$)/g );
	private _regexSearchVariables = new RegExp( /(?<=^|\/):(\w+)(?:\[(09|AZ|AZ09)])?(?=\/|$)/g );
	private _routes: Route[] = [];
	private _routeFunction403: ( RouteFunction | undefined ) = undefined;
	private _routeFunction404: ( RouteFunction | undefined ) = undefined;
	private _routeFunction500: ( RouteFunction | undefined ) = undefined;
	private _routing: boolean = false;
	private _queue: string[] = [];

	private _inTransition: boolean = false;
	private _currentState: string;
	private _states: { [ key: string ]: { OnEnter: FunctionOnEnter[], OnLeave: FunctionOnLeave[] } } = {};
	private _transitions: { [ key: string ]: { [ key: string ]: { OnBefore: FunctionOnTransitionBefore[], OnAfter: FunctionOnTransitionAfter[] } } } = {};

	private constructor( initialState: string ) {
		window.addEventListener( "hashchange", this.CheckHash.bind( this ) );
		this.StateAdd( initialState );
		this._currentState = initialState;
	}

	private static CheckRouteEquivalence( path1: string, path2: string ): boolean {
		const generateVariants = (path: string): string[ ] => {
			let returnValue : string[ ] = [ path ];
			if( path.includes( ':AZ09' ) ) {
				returnValue.push(
					...generateVariants( path.replace( /:AZ09/, ':AZ' ) ),
					...generateVariants( path.replace( /:AZ09/, ':09' ) )
				);
			}
			return returnValue;
		};
		const variants = new Set( generateVariants( path1 ) );
		return [...generateVariants( path2 ) ].some( x => variants.has( x ) );
	}

	public StateAdd( state: string ): boolean {
		let returnValue = false;
		if( 'undefined' === typeof ( this._states[ state ] ) ) {
			this._states[ state ] = {
				OnEnter: [],
				OnLeave: []
			};
			this._transitions[ state ] = {};
			returnValue = true;
		}
		return returnValue;
	}

	public StateDel( state: string ): boolean {
		let returnValue = false;
		if( 'undefined' !== typeof ( this._states[ state ] ) ) {
			delete ( this._states[ state ] );
			if( 'undefined' !== typeof ( this._transitions[ state ] ) ) {
				delete ( this._transitions[ state ] );
			}
			for( const tmpState in this._transitions ) {
				if( 'undefined' !== typeof ( this._transitions[ tmpState ][ state ] ) ) {
					delete ( this._transitions[ tmpState ][ state ] );
				}
			}
			returnValue = true;
		}
		return returnValue;
	}

	public StateOnEnterAdd( state: string, func: FunctionOnEnter ): boolean {
		let returnValue = false;
		if( 'undefined' !== typeof ( this._states[ state ] ) ) {
			if( !this._states[ state ].OnEnter.includes( func ) ) {
				this._states[ state ].OnEnter.push( func );
				returnValue = true;
			}
		}
		return returnValue;
	}

	public StateOnEnterDel( state: string, func: FunctionOnEnter ): boolean {
		let returnValue = false;
		if( 'undefined' !== typeof ( this._states[ state ] ) ) {
			const pos = this._states[ state ].OnEnter.indexOf( func );
			if( -1 !== pos ) {
				this._states[ state ].OnEnter.splice( pos, 1 );
				returnValue = true;
			}
		}
		return returnValue;
	}

	public StateOnLeaveAdd( state: string, func: FunctionOnLeave ): boolean {
		let returnValue = false;
		if( 'undefined' !== typeof ( this._states[ state ] ) ) {
			if( !this._states[ state ].OnLeave.includes( func ) ) {
				this._states[ state ].OnLeave.push( func );
				returnValue = true;
			}
		}
		return returnValue;
	}

	public StateOnLeaveDel( state: string, func: FunctionOnLeave ): boolean {
		let returnValue = false;
		if( 'undefined' !== typeof ( this._states[ state ] ) ) {
			const pos = this._states[ state ].OnLeave.indexOf( func );
			if( -1 !== pos ) {
				this._states[ state ].OnLeave.splice( pos, 1 );
				returnValue = true;
			}
		}
		return returnValue;
	}

	public TransitionAdd( from: string, to: string ): boolean {
		let returnValue = false;
		if( ( 'undefined' !== typeof ( this._states[ from ] ) ) && ( 'undefined' !== typeof ( this._states[ to ] ) ) ) {
			if( 'undefined' === typeof ( this._transitions[ from ][ to ] ) ) {
				this._transitions[ from ][ to ] = {
					OnBefore: [],
					OnAfter: []
				};
				returnValue = true;
			}
		}
		return returnValue;
	}

	public TransitionDel( from: string, to: string ): boolean {
		let returnValue = false;
		if( ( 'undefined' !== typeof ( this._states[ from ] ) ) && ( 'undefined' !== typeof ( this._states[ to ] ) ) ) {
			if( 'undefined' !== typeof ( this._transitions[ from ][ to ] ) ) {
				delete ( this._transitions[ from ][ to ] );
				returnValue = true;
			}
		}
		return returnValue;
	}

	public TransitionOnBeforeAdd( from: string, to: string, func: FunctionOnTransitionBefore ): boolean {
		let returnValue = false;
		if( ( 'undefined' !== typeof ( this._states[ from ] ) ) && ( 'undefined' !== typeof ( this._states[ to ] ) ) ) {
			if( 'undefined' !== typeof ( this._transitions[ from ][ to ] ) ) {
				this._transitions[ from ][ to ].OnBefore.push( func );
				returnValue = true;
			}
		}
		return returnValue;
	}

	public TransitionOnBeforeDel( from: string, to: string, func: FunctionOnTransitionBefore ): boolean {
		let returnValue = false;
		if( ( 'undefined' !== typeof ( this._states[ from ] ) ) && ( 'undefined' !== typeof ( this._states[ to ] ) ) ) {
			if( 'undefined' !== typeof ( this._transitions[ from ][ to ] ) ) {
				const pos = this._transitions[ from ][ to ].OnBefore.indexOf( func );
				if( -1 !== pos ) {
					this._transitions[ from ][ to ].OnBefore.splice( pos, 1 );
					returnValue = true;
				}
			}
		}
		return returnValue;
	}

	public TransitionOnAfterAdd( from: string, to: string, func: FunctionOnTransitionAfter ): boolean {
		let returnValue = false;
		if( ( 'undefined' !== typeof ( this._states[ from ] ) ) && ( 'undefined' !== typeof ( this._states[ to ] ) ) ) {
			if( 'undefined' !== typeof ( this._transitions[ from ][ to ] ) ) {
				this._transitions[ from ][ to ].OnAfter.push( func );
				returnValue = true;
			}
		}
		return returnValue;
	}

	public TransitionOnAfterDel( from: string, to: string, func: FunctionOnTransitionAfter ): boolean {
		let returnValue = false;
		if( ( 'undefined' !== typeof ( this._states[ from ] ) ) && ( 'undefined' !== typeof ( this._states[ to ] ) ) ) {
			if( 'undefined' !== typeof ( this._transitions[ from ][ to ] ) ) {
				const pos = this._transitions[ from ][ to ].OnAfter.indexOf( func );
				if( -1 !== pos ) {
					this._transitions[ from ][ to ].OnAfter.splice( pos, 1 );
					returnValue = true;
				}
			}
		}
		return returnValue;
	}

	public StateGet(): string {
		return this._currentState;
	}

	public async StateSet( nextState: string ): Promise<boolean> {
		let returnValue = false;
		if( !this._inTransition ) {
			this._inTransition = true;
			if( 'undefined' !== typeof ( this._states[ nextState ] ) ) {
				if( ( 'undefined' !== typeof ( this._transitions[ this._currentState ] ) ) && ( 'undefined' !== typeof ( this._transitions[ this._currentState ][ nextState ] ) ) ) {
					returnValue = true;
					let cFL;
					// Check if I can enter the new state: in case a function return false, abort
					cFL = this._transitions[ this._currentState ][ nextState ].OnBefore.length;
					for( let iFL = 0; ( returnValue && ( iFL < cFL ) ); iFL++ ) {
						if( 'function' === typeof ( this._transitions[ this._currentState ][ nextState ].OnBefore[ iFL ] ) ) {
							let tmpValue = null;
							if( 'AsyncFunction' === this._transitions[ this._currentState ][ nextState ].OnBefore[ iFL ].constructor.name ) {
								tmpValue = await this._transitions[ this._currentState ][ nextState ].OnBefore[ iFL ]();
							} else {
								tmpValue = this._transitions[ this._currentState ][ nextState ].OnBefore[ iFL ]();
							}
							returnValue = ( false !== tmpValue );
						}
					}
					if( returnValue ) {
						cFL = this._states[ this._currentState ].OnLeave.length;
						for( let iFL = 0; iFL < cFL; iFL++ ) {
							if( 'function' === typeof ( this._states[ this._currentState ].OnLeave[ iFL ] ) ) {
								if( 'AsyncFunction' === this._states[ this._currentState ].OnLeave[ iFL ].constructor.name ) {
									await this._states[ this._currentState ].OnLeave[ iFL ]( this._currentState, nextState );
								} else {
									this._states[ this._currentState ].OnLeave[ iFL ]( this._currentState, nextState );
								}
							}
						}
						let previousState: string = this._currentState;
						this._currentState = nextState;
						cFL = this._transitions[ previousState ][ this._currentState ].OnAfter.length;
						for( let iFL = 0; iFL < cFL; iFL++ ) {
							if( 'function' === typeof ( this._transitions[ previousState ][ this._currentState ].OnAfter[ iFL ] ) ) {
								if( 'AsyncFunction' === this._transitions[ previousState ][ this._currentState ].OnAfter[ iFL ].constructor.name ) {
									await this._transitions[ previousState ][ this._currentState ].OnAfter[ iFL ]();
								} else {
									this._transitions[ previousState ][ this._currentState ].OnAfter[ iFL ]();
								}
							}
						}
						cFL = this._states[ this._currentState ].OnEnter.length;
						for( let iFL = 0; iFL < cFL; iFL++ ) {
							if( 'function' === typeof ( this._states[ this._currentState ].OnEnter[ iFL ] ) ) {
								if( 'AsyncFunction' === this._states[ this._currentState ].OnEnter[ iFL ].constructor.name ) {
									await this._states[ this._currentState ].OnEnter[ iFL ]( this._currentState, previousState );
								} else {
									this._states[ this._currentState ].OnEnter[ iFL ]( this._currentState, previousState );
								}
							}
						}
					}
				}
			}
			this._inTransition = false;
		}
		return returnValue;
	}

	public CheckTransition( nextState: string ): boolean {
		let returnValue = false;
		if( !this._inTransition ) {
			if( 'undefined' !== typeof ( this._states[ nextState ] ) ) {
				if( ( 'undefined' !== typeof ( this._transitions[ this._currentState ] ) ) && ( 'undefined' !== typeof ( this._transitions[ this._currentState ][ nextState ] ) ) ) {
					returnValue = true;
				}
			}
		}
		return returnValue;
	}

	public RouteSpecialAdd( code: number, routeFunction: RouteFunction ) {
		let returnValue = false;
		switch( code ) {
			case 403: {
				this._routeFunction403 = routeFunction;
				returnValue = true;
				break;
			}
			case 404: {
				this._routeFunction404 = routeFunction;
				returnValue = true;
				break;
			}
			case 500: {
				this._routeFunction500 = routeFunction;
				returnValue = true;
				break;
			}
			default: {
				throw new RangeError();
			}
		}
		return returnValue;
	}

	public RouteAdd( validState: string, path: string, routeFunction: RouteFunction, available?: CheckAvailability, routeFunction403?: RouteFunction ) {
		let returnValue = false;
		if( 'undefined' === typeof ( this._states[ validState ] ) ) {
			throw new SyntaxError( 'Non-existent state' );
		} else {
			if( path.match( this._regexDuplicatePathId ) ) {
				throw new SyntaxError( 'Duplicate path id' );
			} else {
				let weight = 0;
				const paths = path.split( '/' );
				const cFL = paths.length;
				for( let iFL = 0; iFL < cFL; iFL++ ) {
					if( !paths[ iFL ].startsWith( ':' ) ) {
						weight += 2 ** ( cFL - iFL - 1 );
					}
				}
				let regex = new RegExp( '^' + path.replace( this._regexSearchVariables,
					function( _unused, name, type ) {
						let returnValue = '(?<' + name + '>[';
						switch( type ) {
							case '09': {
								returnValue += '\\d';
								break;
							}
							case 'AZ': {
								returnValue += 'a-zA-Z';
								break;
							}
							case 'AZ09':
							default: {
								returnValue += 'a-zA-Z\\d';
							}
						}
						returnValue += ']+)';
						return returnValue;
					} ).replace( /\//g, '\\\/' ) + '$' );
				const reducedPath = path.replace(
					this._regexSearchVariables,
					( _, __, component ) => `:${component ?? 'AZ09'}`
				);
				if( !this._routes.find( ( route: Route ) : boolean => jFSMRouter.CheckRouteEquivalence( reducedPath, route.path ) ) ) {
					this._routes.push( {
						path: reducedPath,
						validState: validState,
						match: regex,
						weight: weight,
						routeFunction: routeFunction,
						available: available,
						routeFunction403: routeFunction403
					} );
					this._routes.sort(
						( a, b ) => ( ( a.weight > b.weight ) ? -1 : ( ( b.weight > a.weight ) ? 1 : 0 ) )
					);
					returnValue = true;
				}
			}
		}
		return returnValue;
	}

	public RouteDel( path: string ) {
		let returnValue = false;
		if( path.match( this._regexDuplicatePathId ) ) {
			throw new SyntaxError( 'Duplicate path id' );
		} else {
			const reducedPath = path.replace(
				this._regexSearchVariables,
				( _, __, component ) => `:${component ?? 'AZ09'}`
			);
			const index = this._routes.findIndex( ( route : Route ) : boolean => jFSMRouter.CheckRouteEquivalence( reducedPath, route.path ) );
			if( -1 < index ) {
				this._routes.splice( index, 1 );
				returnValue = true;
			}
		}
		return returnValue;
	}

	public Trigger( path: string ) {
		if( '#' + path != window.location.hash ) {
			window.location.hash = '#' + path;
		}
	}

	public async Route( path: string ): Promise<void> {
		this._routing = true;
		let routeFunction: ( RouteFunction | undefined ) = undefined;
		let routePath: string = '';
		let result: ( RegExpExecArray | null ) = null;
		for( const route of this._routes ) {
			if( ( result = route.match.exec( path ) ) ) {
				routePath = route.path;
				let available: boolean = false;
				if( route.available ) {
					if( 'function' === typeof route.available ) {
						if( 'AsyncFunction' === route.available.constructor.name ) {
							available = await route.available( routePath, path, ( result.groups ?? {} ) );
						} else {
							// @ts-ignore
							available = route.available( routePath, path, ( result.groups ?? {} ) );
						}
					}
				}
				if( available &&
						(
							( 'undefined' === typeof route.validState ) ||
							( this._currentState === route.validState ) ||
							( this.CheckTransition( route.validState ) )
						)
				) {
					if( route.validState && ( this._currentState !== route.validState ) ) {
						routeFunction = route.routeFunction;
						if( !( await this.StateSet( route.validState ) ) ) {
							routeFunction = this._routeFunction500;
						}
					} else {
						routeFunction = this._routeFunction500;
					}
				} else if( route.routeFunction403 ) {
					routeFunction = route.routeFunction403;
				} else if( this._routeFunction403 ) {
					routeFunction = this._routeFunction403;
				}
				break;
			}
		}
		if( !routeFunction ) {
			if( this._routeFunction404 ) {
				routeFunction = this._routeFunction404;
			}
		}
		if( 'function' !== typeof routeFunction ) {
			if( this._routeFunction500 ) {
				routeFunction = this._routeFunction500;
			}
		}
		if( routeFunction && ( 'function' === typeof routeFunction ) ) {
			if( 'AsyncFunction' === routeFunction.constructor.name ) {
				await routeFunction( routePath, path, ( result?.groups ?? {} ) );
			} else {
				routeFunction( routePath, path, ( result?.groups ?? {} ) );
			}
		}
		if( this._queue.length ) {
			await this.Route( <string> this._queue.shift() );
		} else {
			this._routing = false;
		}
	}

	public async CheckHash(): Promise<void> {
		const hash = ( window.location.hash.startsWith( '#' ) ? window.location.hash.substring( 1 ) : '' );
		if( '' != hash ) {
			if( this._routing ) {
				this._queue.push( hash );
			} else {
				await this.Route( hash );
			}
		}
	}
}
