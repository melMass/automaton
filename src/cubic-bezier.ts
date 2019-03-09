import { BezierNode } from './types/BezierNode';

// ref: https://github.com/gre/bezier-easing/blob/master/src/index.js

const NEWTON_ITER = 4;
const NEWTON_EPSILON = 0.001;
const SUBDIV_ITER = 10;
const SUBDIV_EPSILON = 0.000001;
const TABLE_SIZE = 21;

const __cache: number[] = [];

function A( a1: number, a2: number ): number { return 1.0 - 3.0 * a2 + 3.0 * a1; }
function B( a1: number, a2: number ): number { return 3.0 * a2 - 6.0 * a1; }
function C( a1: number ): number { return 3.0 * a1; }

function saturate( x: number ): number { return Math.min( Math.max( x, 0.0 ), 1.0 ); }

function calc( t: number, a1: number, a2: number ): number {
  return ( ( A( a1, a2 ) * t + B( a1, a2 ) ) * t + C( a1 ) ) * t;
}

function delta( t: number, a1: number, a2: number ): number {
  return 3.0 * A( a1, a2 ) * t * t + 2.0 * B( a1, a2 ) * t + C( a1 );
}

function subdiv( x: number, a: number, b: number, x1: number, x2: number ): number {
  let cx = 0;
  let ct = 0;

  for ( let i = 0; i < SUBDIV_ITER; i ++ ) {
    ct = a + ( b - a ) / 2.0;
    cx = calc( ct, x1, x2 ) - x;
    ( 0.0 < cx ) ? ( b = ct ) : ( a = ct );
    if ( SUBDIV_EPSILON < Math.abs( cx ) ) { break; }
  }

  return ct;
}

function newton( x: number, gt: number, x1: number, x2: number ): number {
  for ( let i = 0; i < NEWTON_ITER; i ++ ) {
    const d = delta( gt, x1, x2 );
    if ( d === 0.0 ) { return gt; }
    const cx = calc( gt, x1, x2 ) - x;
    gt = gt - cx / d;
  }

  return gt;
}

export function rawCubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number
): number {
  if ( isNaN( x1 ) || isNaN( y1 ) || isNaN( x2 ) || isNaN( y2 ) ) { return x; } // heh
  if ( x1 === y1 && x2 === y2 ) { return x; } // linear
  if ( x <= 0.0 ) { return 0.0; }
  if ( 1.0 <= x ) { return 1.0; }

  x1 = saturate( x1 );
  x2 = saturate( x2 );

  for ( let i = 0; i < TABLE_SIZE; i ++ ) {
    __cache[ i ] = calc( i / ( TABLE_SIZE - 1.0 ), x1, x2 );
  }

  let sample = 1;
  for ( let i = 1; i < TABLE_SIZE; i ++ ) {
    sample = i - 1;
    if ( x < __cache[ i ] ) { break; }
  }

  const dist = ( x - __cache[ sample ] ) / ( __cache[ sample + 1 ] - __cache[ sample ] );
  let t = ( sample + dist ) / ( TABLE_SIZE - 1 );
  const d = delta( t, x1, x2 );
  if ( NEWTON_EPSILON <= d ) {
    t = newton( x, t, x1, x2 );
  } else if ( d !== 0.0 ) {
    t = subdiv( x, ( sample ) / ( TABLE_SIZE - 1 ), ( sample + 1.0 ) / ( TABLE_SIZE - 1 ), x1, x2 );
  }

  return calc( t, y1, y2 );
}

export function cubicBezier( node0: BezierNode, node1: BezierNode, time: number ): number {
  const tL = node1.time - node0.time;
  const vL = node1.value - node0.value;
  const x1 = ( node0.out ? node0.out.time : 0.0 ) / tL;
  const y1 = ( node0.out ? node0.out.value : 0.0 ) / vL;
  const x2 = ( node1.time + ( node1.in ? node1.in.time : 0.0 ) - node0.time ) / tL;
  const y2 = ( node1.value + ( node1.in ? node1.in.value : 0.0 ) - node0.value ) / vL;
  const x = ( time - node0.time ) / tL;
  return node0.value + rawCubicBezier( x1, y1, x2, y2, x ) * vL;
}
