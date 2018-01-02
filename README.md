# Cheetah3DThread

This is a plugin JavaScript for the Cheetah3D Modeler. By default, you can
created threaded cylinders in multiple different ways with Cheetah3D but all
the ones that I tried didn't deliver satisfying results when it came to 3D
printing. And, they all took several steps in the UI.
But Cheetah3D supports custom scripts to be executed from the Tools/Script
menu. I wrote this little JavaScript, which enhances Cheetah3D by a generator
for threaded cylinders. These cylinders can be configured via the Cheetah3D
property manager through attributes like radius, number of thread turns,
thread height... and so on.

![alt text](/images/ThreadEditor.png?raw=true "Cheetah3D Object Editor")

The so created threaded cylinders can then be used in conjunction with all
other, normal Cheetah3D objects. You can for example create a bolt nut by using
the boolean operator, subtracting a threaded cylinder from the nut.

![alt text](/images/ThreadRenderer.png?raw=true "Bolt Nut Rendered")

Have fun with this script.
