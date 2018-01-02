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
const LEAD     = "Lead";

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
  obj.addParameterFloat( INNERRAD, 1.0, 0.1, 100, true, true );
  obj.addParameterFloat( OUTERRAD, 1.2, 0.1, 100, true, true );
  obj.addParameterInt( STEPS,64,10,500,true,true);
  obj.addParameterInt( TURNS, 6, 1, 1000, true, true );
  obj.addParameterFloat( MOVE, 0.3, 0.01, 100, true, true );
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
  let core      = obj.core();
  let rotations = obj.getParameter( TURNS );
  let steps     = obj.getParameter( STEPS );
  let radiusI   = obj.getParameter( INNERRAD );
  let radiusO   = obj.getParameter( OUTERRAD );
  let height    = obj.getParameter( MOVE );
  let lead      = obj.getParameter( LEAD );
  let leadOut   = obj.getParameter( LEADOUT );
  let leadIn    = obj.getParameter( LEADIN );
  let yOff      = lead;

  // yOff is the distance from zero height pane
  if ( leadIn == false ) {
    yOff = 0.0;
  }

  // create the threaded sides
  for ( let rot = 0; rot < rotations; ++rot ) {
    let yL = rot * height + yOff;
    let yM = yL + (height / 2);
    let p0 = core.vertexCount();

    addVertexRing( core, steps, radiusI, yL, height, true );  // lower vertices

    // connect previous rotation to new lower rotation
    if ( rot > 0 ) {
      createPolygons( core, steps, p0 - steps );
    }

    addVertexRing( core, steps, radiusO, yM, height, true );  // middle ring
    createPolygons( core, steps, p0 );

    // for the last winding, add finishing top ring
    if ( rot + 1 == rotations ) {
      addVertexRing( core, steps, radiusI, yL + height, height, true );
      createPolygons( core, steps, p0 + steps );
    }
  }

  // close the gap (between last of previous and first of current rotation)
  closeThreadGaps( core, steps, rotations );

  // add lead out and close top
  if ( leadOut ) {
    createLeadOut( core, steps, radiusI, rotations, height, lead, yOff );
  }

  // add the lead in and close bottom
  if ( leadIn ) {
    createLeadIn( core, steps, radiusI, height, lead );
  }
}

// Helper to create a ring of vertices
// Produces a ring of vertices, optionally with increasing height.
//
// Parameters:
//    core          The object core to add vertices to
//    steps         Amount of steps for a full rotatation
//    radius        Radius of a single rotation
//    yStart        Vertical starting position for vertices
//    height        height difference for one rotation
//    movingHeight  Flag to increase hight per step up to specified height
// -------------------------------------------------------------------------
function addVertexRing( core, steps, radius, yStart, height, movingHeight ) {
  for ( let step = 0; step < steps; ++step ) {
    let ang = Math.PI * (step / steps) * 2;
    let x   = Math.cos( ang ) * radius;
    let y   = yStart + ((height / steps) * step);
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
//    core          The object core to add vertices to
//    steps         Amount of steps for a full rotatation
//    firstVertex   Vertex index of first point on lower layer
// -------------------------------------------------------------------------
function createPolygons( core, steps, firstVertex ) {
  for ( let step = 0; step < steps - 1; ++step ) {
    let p0 = firstVertex + step;

    // the next (higher) layer is direcely steps vertices away
    core.addIndexPolygon( 4, [ p0, p0 + 1, p0 + 1 + steps, p0 + steps] );
  }
}

// Helper to close the gaps in the threading.
// We automatically create the thread polygons between all points of the first
// and the last vertex of a specific thread leayer (rotation) via the
// createPolygons function. But this leaves a gap between the last vertices of
// one layer and the first vertices of the next layer. This gap is filled with
// polygons by this function (reusing the existing vertices).
//
// Parameters:
//    core        The object core to add vertices to
//    steps       Amount of steps for a full rotatation
//    rotations   Total amount of thread rotations
// -------------------------------------------------------------------------
function closeThreadGaps( core, steps, rotations ) {
  for ( let rot = 0; rot < rotations - 1; ++rot ) {
    let s2     = steps * 2;
    let p0Last = (rot * s2) + (steps - 1);
    let p1Next = (rot + 1) * s2;

    core.addIndexPolygon( 4, [ p1Next, p1Next + steps, p0Last + steps, p0Last ] );
    core.addIndexPolygon( 4, [ p1Next + steps, p1Next + s2, p0Last + s2, p0Last + steps ] );
  }
}

// Helper to create the optional lead in.
// The lead in is that part of the cylinder that connects the flat circular
// surface of the "cylinder" with the first thread rotation. It is optional
// but required to get a closed object. The lead in starts at the bottom (zero
// height) and leads to the first thread rotation.
//
// Parameters:
//    core      The object core to add vertices to
//    steps     Amount of steps for a full rotatation
//    radiusI   Inner radius of the cylinder
//    height    Height of a single thread winding
//    lead      Height of the lead in area
// -------------------------------------------------------------------------
function createLeadIn( core, steps, radiusI, height, lead ) {
  let p0 = core.vertexCount();
  addVertexRing( core, steps, radiusI, 0, 0, false );

  // create lead in side segements
  for ( let step = 0; step < steps - 1; ++step ) {
    core.addIndexPolygon( 4, [p0 + step, p0 + step + 1, step + 1, step ] );
  }

  // close gap of lead in
  let pLU = core.vertex( steps - 1 );
  let pLM = new Vec3D( pLU.x, pLU.y - (height / 2), pLU.z );
  core.addVertex( false, pLM );
  core.addIndexPolygon( 3, [ steps, 2 * steps, core.vertexCount() - 1 ] );
  core.addIndexPolygon( 3, [ steps, core.vertexCount() - 1, 0 ] );
  core.addIndexPolygon( 3, [ 2 * steps, steps - 1, core.vertexCount() - 1 ] );
  core.addIndexPolygon( 4, [ p0, 0, core.vertexCount() - 1, p0 + steps - 1 ] );

  // add center point at 0/0/0 for the bottom lid
  let pC = core.addVertex( false, new Vec3D( 0, 0, 0 ) );

  // clode the bottom lid
  for ( let step = 0; step < steps - 1; ++step ) {
    core.addIndexPolygon( 3, [ pC, p0 + step + 1, p0 + step ] );
  }

  core.addIndexPolygon( 3, [ pC, p0, p0 + steps - 1 ] );
}

// Helper to create the optional lead out.
// The lead out is that part of the cylinder that connects the flat circular
// surface of the "cylinder" with the last thread rotation. It is optional
// but required to get a closed object. The lead out starts at the top and leads
// to the last thread rotation.
//
// Parameters:
//    core       The object core to add vertices to
//    steps      Amount of steps for a full rotatation
//    radiusI    Inner radius of the cylinder
//    rotations  Total number of thread rotations
//    height     Height of a single thread winding
//    lead       Height of the lead in area
//    yOff       Additional, vertical offset (caused by optional lead in)
// -------------------------------------------------------------------------
function createLeadOut( core, steps, radiusI, rotations, height, lead, yOff ) {
  let p0 = core.vertexCount() - 1;

  // create lead out
  addVertexRing( core, steps, radiusI, rotations * height + yOff, height + lead, false );
  createPolygons( core, steps, p0 - steps + 1 );

  // close gap of lead out
  let pLD = core.vertex( p0 + 1 - steps );  // left down (bottom of lead out)
  let pLM = new Vec3D( pLD.x, pLD.y + (height / 2), pLD.z );

  core.addVertex( false, pLM );  // add midpoint between pLD and up
  core.addIndexPolygon( 3, [ p0, p0 - steps, core.vertexCount() - 1 ] );
  core.addIndexPolygon( 3, [ p0 - steps, p0 - (2 * steps), core.vertexCount() - 1 ] );
  core.addIndexPolygon( 4, [ p0 + steps, p0, core.vertexCount() - 1, p0 + 1 ] );
  core.addIndexPolygon( 3, [ p0 - (2 * steps),  p0 - steps + 1, core.vertexCount() - 1 ] );

  // create center point for top lid
  let pC = new Vec3D( 0, (rotations * height) + height + lead + yOff, 0 );
  core.addVertex( false, pC );

  for ( let step = 0; step < steps - 1; ++step ) {
    core.addIndexPolygon( 3, [ p0 + 1 + step, p0 + 2 + step, core.vertexCount() - 1 ] );
  }

  core.addIndexPolygon( 3, [ p0 + 1, core.vertexCount() - 1, p0 + steps ] );
}
