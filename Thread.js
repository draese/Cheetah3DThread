/******************************************************************************/
/* Cheetah3D helper script to produce a threaded cylinder.                    */
/* There are multiple ways to create a threaded cylinder in Cheetah3D but     */
/* they are all suboptimal when you want to use the cylinder for 3D print or  */
/* even as part of a boolen operation (like intersect). This script is        */
/* generating a threaded cylinder based on UI input parameters, producing one */
/* Cheetah3D object that can be used in subsequent operations.                */
/*                                                                            */
/* Installation:                                                              */
/*    Copy the script to the                                                  */
/*    "~/Library/Application Support/Cheetah3D/Scripts/Polygonobj/" folder    */
/*    and restart Cheetah3D                                                   */
/*                                                                            */
/* License: Creative Commons, Public Domain Dedication (CC0)                  */
/* You should have received a copy of the CC0 legalcode along with this       */
/* work.  If not, see <http://creativecommons.org/publicdomain/zero/1.0/>.    */
/*                                                                            */
/* Oliver Draese, 2018                                                        */
/******************************************************************************/

// decare the input UI parameters for the script
// --------------------------------------------------

// is this a left or right rotating thread
const DIRECTION = "Direction";
const LEFT      = "Left";
const RIGHT     = "Right";

// the radius of the inner cylinder
const INNERRAD = "Inner Radius";

// the radius of the outer thread
const OUTERRAD = "Thread Radius";

// how many polygon steps per turn/rotation
const STEPS    = "Steps / Turn";

// how many turns (implicit defines hight of pbject)
const TURNS    = "Turns";

// the height of a single thread turn
const MOVE     = "Height / Turn";

// space before and after thread starts/ends
const LEAD     = "Lenght";

// indicator that we want to create a lead - in (bottom)
const LEADIN   = "Create Lead-In";

// indicator that we want to create a lead - out (top)
const LEADOUT  = "Create Lead-Out";

// Called by Cheetah3D to gather the list of parameters.
//
// Parameters:
//    obj The created object (Base)
// -------------------------------------------------------------------------
function buildUI( obj ){
  obj.setParameter( "name","Thread" );
  obj.addParameterSelector( DIRECTION, [LEFT, RIGHT ], true, true );

  obj.addParameterSeparator( "Thread Parameers" );
  obj.addParameterFloat( INNERRAD, 1.0, 0.1, 100, true, true );
  obj.addParameterFloat( OUTERRAD, 1.2, 0.1, 100, true, true );
  obj.addParameterInt( STEPS,64,10,500,true,true);
  obj.addParameterInt( TURNS, 6, 1, 1000, true, true );
  obj.addParameterFloat( MOVE, 0.3, 0.01, 100, true, true );

  obj.addParameterSeparator( "Lead Parameters" );
  obj.addParameterFloat( LEAD, 0.1, 0.01, 100, true, true );
  obj.addParameterBool( LEADOUT, true, false, true, true, true );
  obj.addParameterBool( LEADIN, true, false, true, true, true );
}

// Called by Cheetah3D to build the objects, whenever parameters change.
// While the buildUI is only called once to initialize the parameter list, this
// function is called by Cheetah3D whenever the parameters are changed (or at
// least once for the initial version of the object). It add the vertices add
// polygons for the threaded cylinder.
//
// Parameters:
//    obj The created object (Base)
// -------------------------------------------------------------------------
function buildObject( obj ){
  // delegate creation to dedicated generator class
  let generator = new ThreadGenerator( obj );
  generator.buildThread();
}

/******************************************************************************/
/* Helper class to contain the actual generating code.                        */
/* This code was implemented as class to allow carrying all the parameter     */
/* values as member properties instead of passing them in from helper to      */
/* helper function repeatedly.                                                */
/******************************************************************************/

// Constructor of the ThreadGenerator class.
// This constructor extracts all parameter values from the passed in object
// and stores them as member properties. The so created instance then can
// be used to call its buildThread member function to produce the vertices
// and polygons.
//
// Parameters:
//    obj The object, carrying all the parameter values
// -------------------------------------------------------------------------
function ThreadGenerator( polyObject ) {
  this.core      = polyObject.core();
  this.rotations = polyObject.getParameter( TURNS );
  this.steps     = polyObject.getParameter( STEPS );
  this.radiusI   = polyObject.getParameter( INNERRAD );
  this.radiusO   = polyObject.getParameter( OUTERRAD );
  this.height    = polyObject.getParameter( MOVE );
  this.lead      = polyObject.getParameter( LEAD );
  this.leadOut   = polyObject.getParameter( LEADOUT );
  this.leadIn    = polyObject.getParameter( LEADIN );

  if ( this.leadIn == false ) {
    this.yOff = 0.0;
  }
  else {
    this.yOff = this.lead;
  }
}

// Generates the threaded cylinder.
// This is the only method that is supposed to be called from outside.
// -------------------------------------------------------------------------
ThreadGenerator.prototype.buildThread = function() {
  let rMax = this.rotations;  // the number of thread rotations
  let sMax = this.steps;      // amount of steps per rortation
  let h    = this.height;     // height difference in one rotation
  let rI   = this.radiusI;    // inner cylinder radius
  let rO   = this.radiusO;    // outer (thread) radius
  let yOff = this.yOff;       // height offset due to lead in

  // create the threaded sides
  for ( let rot = 0; rot < rMax; ++rot ) {
    let yL = rot * h + yOff;
    let yM = yL + (h / 2);
    let p0 = this.core.vertexCount();

    this.addVertexRing( rI, yL, h, true );  // lower vertices

    // connect previous rotation to new lower rotation
    if ( rot > 0 ) {
      this.createPolygons( p0 - sMax );
    }

    this.addVertexRing( rO, yM, h, true );  // middle ring
    this.createPolygons( p0 );

    // for the last winding, add finishing top ring
    if ( rot + 1 == rMax ) {
      this.addVertexRing( rI, yL + h, h, true );
      this.createPolygons( p0 + sMax );
    }
  }

  // close the gap (between last of previous and first of current rotation)
  this.closeThreadGaps();

  // add lead out and close top
  if ( this.leadOut ) {
    this.createLeadOut();
  }

  // add the lead in and close bottom
  if ( this.leadIn ) {
    this.createLeadIn();
  }
}

// Helper to create a ring of vertices
// Produces a ring of vertices, optionally with increasing height.
//
// Parameters:
//    radius        Radius of a single rotation
//    yStart        Vertical starting position for vertices
//    height        height difference for one rotation
//    movingHeight  Flag to increase hight per step up to specified height
// -------------------------------------------------------------------------
ThreadGenerator.prototype.addVertexRing = function( radius, yStart, height, movingHeight ) {
  let sMax = this.steps;  // steps per thread rotation
  let core = this.core;   // the object to add polygons to

  for ( let step = 0; step < sMax; ++step ) {
    let ang = Math.PI * (step / sMax) * 2;
    let x   = Math.cos( ang ) * radius;
    let y   = yStart + ((height / sMax) * step);
    let z   = Math.sin( ang ) * radius;

    if ( movingHeight == false ) {
      // take max height if we don't want to have increasing height
      y = yStart + height;
    }

    core.addVertex( false, new Vec3D( x, y, z ) );
  }
}

// Helper to create polygons between two layeres of vertices.
// Creates square polygons between the by firstVertex specified layer and the
// layer that was created directly (above) after that layer.
//
// Parameters:
//    firstVertex   Vertex index of first point on lower layer
// -------------------------------------------------------------------------
ThreadGenerator.prototype.createPolygons = function( firstVertex ) {
  let sMax = this.steps;  // steps per thread rotation
  let core = this.core;   // the object to add polygons to

  for ( let step = 0; step < sMax - 1; ++step ) {
    let p0 = firstVertex + step;

    // the next (higher) layer is direcely steps vertices away
    core.addIndexPolygon( 4, [ p0, p0 + 1, p0 + 1 + sMax, p0 + sMax ] );
  }
}

// Helper to close the gaps in the threading.
// We automatically create the thread polygons between all points of the first
// and the last vertex of a specific thread leayer (rotation) via the
// createPolygons function. But this leaves a gap between the last vertices of
// one layer and the first vertices of the next layer. This gap is filled with
// polygons by this function (reusing the existing vertices).
// -------------------------------------------------------------------------
ThreadGenerator.prototype.closeThreadGaps = function() {
  let rMax = this.rotations;   // total amount of thread rotations
  let sMax = this.steps;       // steps per thread rotation
  let core = this.core;        // the object to add polygons to

  for ( let rot = 0; rot < rMax - 1; ++rot ) {
    let s2     = sMax * 2;
    let p0Last = (rot * s2) + (sMax - 1);
    let p1Next = (rot + 1) * s2;

    core.addIndexPolygon( 4, [ p1Next, p1Next + sMax, p0Last + sMax, p0Last ] );
    core.addIndexPolygon( 4, [ p1Next + sMax, p1Next + s2, p0Last + s2, p0Last + sMax ] );
  }
}

// Helper to create the optional lead in.
// The lead in is that part of the cylinder that connects the flat circular
// surface of the "cylinder" with the first thread rotation. It is optional
// but required to get a closed object. The lead in starts at the bottom (zero
// height) and leads to the first thread rotation.
// -------------------------------------------------------------------------
ThreadGenerator.prototype.createLeadIn = function() {
  let rI      = this.radiusI;            // inner cylinder radius
  let sMax    = this.steps;              // steps per thread rotation
  let numPRot = sMax * 2;                // number vertices per thread rotation
  let h       = this.height;             // hight difference of one thread turn
  let core    = this.core;               // the object to add polygons to
  let p0      = core.vertexCount();      // index of first point

  this.addVertexRing( rI, 0, 0, false );

  // create lead in side segements
  for ( let step = 0; step < sMax - 1; ++step ) {
    core.addIndexPolygon( 4, [p0 + step, p0 + step + 1, step + 1, step ] );
  }

  // close gap of lead in
  let pLU   = core.vertex( sMax - 1 );
  let pLM   = new Vec3D( pLU.x, pLU.y - (h / 2), pLU.z );
  let pLast = core.addVertex( false, pLM );

  core.addIndexPolygon( 3, [ sMax, numPRot, pLast ] );
  core.addIndexPolygon( 3, [ sMax, pLast, 0 ] );
  core.addIndexPolygon( 3, [ numPRot, sMax - 1, pLast ] );
  core.addIndexPolygon( 4, [ p0, 0, pLast, p0 + sMax - 1 ] );

  // add center point at 0/0/0 for the bottom lid
  let pC = core.addVertex( false, new Vec3D( 0, 0, 0 ) );

  // clode the bottom lid
  for ( let step = 0; step < sMax - 1; ++step ) {
    core.addIndexPolygon( 3, [ pC, p0 + step + 1, p0 + step ] );
  }

  core.addIndexPolygon( 3, [ pC, p0, p0 + sMax - 1 ] );
}

// Helper to create the optional lead out.
// The lead out is that part of the cylinder that connects the flat circular
// surface of the "cylinder" with the last thread rotation. It is optional
// but required to get a closed object. The lead out starts at the top and leads
// to the last thread rotation.
// -------------------------------------------------------------------------
ThreadGenerator.prototype.createLeadOut = function() {
  let core    = this.core;                   // the object to add polygons to
  let rI      = this.radiusI;                // inner cylinder radius
  let rMax    = this.rotations;              // total amount of rotations
  let yOff    = this.yOff;                   // vertical offset due to lead in
  let lead    = this.lead;                   // lead in/out length
  let sMax    = this.steps;                  // steps per thread rotation
  let numPRot = sMax * 2;                    // number vertices per thread rotation
  let h       = this.height;                 // hight difference of one thread turn
  let p0      = this.core.vertexCount() - 1; // last added vertex

  // create lead out
  this.addVertexRing( rI, rMax * h + yOff, h + lead, false );
  this.createPolygons( p0 - sMax + 1 );

  // close gap of lead out
  let pLD   = core.vertex( p0 + 1 - sMax );  // left down (bottom of lead out)
  let pLM   = new Vec3D( pLD.x, pLD.y + (h / 2), pLD.z );
  let pLast = core.addVertex( false, pLM );  // add midpoint between pLD and up
  core.addIndexPolygon( 3, [ p0, p0 - sMax, pLast ] );
  core.addIndexPolygon( 3, [ p0 - sMax, p0 - numPRot, pLast ] );
  core.addIndexPolygon( 4, [ p0 + sMax, p0, pLast, p0 + 1 ] );
  core.addIndexPolygon( 3, [ p0 - numPRot,  p0 - sMax + 1, pLast ] );

  // create center point for top lid
  let pC = new Vec3D( 0, (rMax * h) + h + lead + yOff, 0 );
  pLast = core.addVertex( false, pC );

  for ( let step = 0; step < sMax - 1; ++step ) {
    core.addIndexPolygon( 3, [ p0 + 1 + step, p0 + 2 + step, pLast ] );
  }

  core.addIndexPolygon( 3, [ p0 + 1, pLast, p0 + sMax ] );
}
