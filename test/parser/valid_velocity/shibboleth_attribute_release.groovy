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

class Value {

  String displayValue
  Value(String displayValue) {
    this.displayValue = displayValue
  }

}

class Attribute {

  List<Value> values;
  String id;
  Attribute(String id, String value) {
    this.id = id
    this.values = [new Value(value)]
  }

}

class AttributeReleaseContext {

  Map<String, Attribute> consentableAttributes =
    ['id1': new Attribute('id1', 'value1'), 'id2': new Attribute('id2', 'value2')]

}

class AttributeReleaseFlowDescriptor {

  boolean perAttributeConsentEnabled = true
  boolean doNotRememberConsentAllowed = true
  boolean globalConsentAllowed = false

}

java.util.function.Function attributeDisplayNameFunction = { attribute -> attribute.id }

[
  'rpUIContext': new RelyingPartyUIContext(),
  'request': new Request(),
  'flowExecutionUrl': '/idp/execution',
  'encoder': new Encoder(),
  'attributeReleaseContext': new AttributeReleaseContext(),
  'attributeDisplayNameFunction': attributeDisplayNameFunction,
  'attributeReleaseFlowDescriptor': new AttributeReleaseFlowDescriptor()
]
