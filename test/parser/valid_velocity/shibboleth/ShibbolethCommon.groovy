class RelyingPartyUIContext {

  String serviceName = 'serviceName'
  String serviceDescription = 'serviceDescription'
  String informationURL = 'informationURL'
  String privacyStatementURL = 'privacyStatementURL'
  String logo = 'logo.png'
  String organizationDisplayName = 'organizationDisplayName'

}

class Request {

  String contextPath = '/idp'

}

class Encoder {

  String encodeForHTMLAttribute(String value) {
    value
  }

  String encodeForHTML(String value) {
    value
  }

}

class SpringMacroRequestContext {

  String getMessage(String key, String defaultMessage) {
    defaultMessage != null ? defaultMessage : key
  }

}

class ShibbolethCommon {

  static Map<String, Object> makeCommonData() {
    [
      'rpUIContext': new RelyingPartyUIContext(),
      'request': new Request(),
      'flowExecutionUrl': '/idp/execution',
      'encoder': new Encoder(),
      'springMacroRequestContext': new SpringMacroRequestContext()
    ]
  }

}
