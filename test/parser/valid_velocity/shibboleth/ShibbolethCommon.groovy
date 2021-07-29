import groovy.transform.Field

class Context {

  Object getSubcontext(String className) {
      switch (className) {
        case 'net.shibboleth.idp.attribute.context.AttributeContext':
          return ShibbolethCommon.attributeContext
        case 'net.shibboleth.idp.profile.context.RelyingPartyContext':
          return ShibbolethCommon.rpUIContext
        default:
          throw new IllegalArgumentException(className)
      }
  }

}

class Attribute {

  List<String> values
  String id
  Attribute(String id, String value) {
    this.id = id
    this.values = [value]
  }

}

class AttributeContext extends Context {

  Map<String, Attribute> unfilteredIdPAttributes = ['id1': new Attribute('id1', 'value1')]

}

class RelyingPartyUIContext extends Context {

  String serviceName = 'serviceName'
  String serviceDescription = 'serviceDescription'
  String informationURL = 'informationURL'
  String privacyStatementURL = 'privacyStatementURL'
  String logo = 'logo.png'
  String organizationDisplayName = 'organizationDisplayName'
  String relyingPartyId = 'relyingPartyId'

}

@Field
static RelyingPartyUIContext rpUIContext = new RelyingPartyUIContext()

@Field
static AttributeContext attributeContext = new AttributeContext()

class ProfileRequestContext extends Context {

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

Map<String, Object> makeCommonData() {
  [
    'rpUIContext': rpUIContext,
    'profileRequestContext': new ProfileRequestContext(),
    'request': new Request(),
    'flowExecutionUrl': '/idp/execution',
    'encoder': new Encoder(),
    'springMacroRequestContext': new SpringMacroRequestContext()
  ]
}
