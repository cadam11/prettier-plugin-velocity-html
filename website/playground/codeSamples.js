export default function (parser) {
  switch (parser) {
    case "velocity-html":
      return `#* 
  Example using as many velocity features as possible
*#
  #macro( formGroupMessage, message  )
<span>#i18n(message.text): #i18n(message.cause)</span>
#end
<html>
#set( $title = "Velocity demo" )
  <title>$title</title>
    <body>
      <div>
  
      <form>
    #foreach(\${formgroup} in $formgroups)
        <div class="form-group">
          #if ($formgroup.hasMessages)
          <ul>
          #foreach($message in $formgroup.messages) 
          <li #if(message.isError) data-error="$message.error"#elseif(message.isWarning) data-warning="warning: $message.warning" #else data-message="$message.text"  #end>
            #formGroupMessage($message)</li>
          #end
          </ul>
        #end
      <label for="$formgroup.name">#i18n($formgroup.name)</label>
        #if($formgroup.type == "select")
      <select multiple class="form-control" id="$formgroup.id">
        #foreach($option in $formgroup.select.options)
        <!-- prettier-ignore -->
        <option #if($option.selected) selected #end>$option</option>
        #end
      </select>
          #end
      </div>
    #end
        <button aria-label="#i18("submit")" type="submit"/>
      </form>
      </div>
    </body>
  
</html>`
    default:
      return "";
  }
}
