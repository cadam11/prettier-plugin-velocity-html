export default function (parser) {
  switch (parser) {
    case "velocity-html":
      return `<html>
<span #if($hasError) class="error"#end>Error</span>
    <body>
    #set( $foo = "Velocity" )
    Hello $foo World!
    </body>
</html>
      `
    default:
      return "";
  }
}
