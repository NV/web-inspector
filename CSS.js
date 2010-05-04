WebInspector.CSS = {
    properties: (function getCSSProperties() {
        var properties = Array.convert(document.defaultView.getComputedStyle(document.documentElement, ""));
        var length = properties.length;
        // Add shorthands.
        for (var i = 0; i < length; ++i) {
            var propertyWords = properties[i].split("-");
            var j = propertyWords.length;
            while (--j) {
                var shorthand = propertyWords.slice(0, j).join("-");
                if (typeof document.documentElement.style[shorthand] !== "undefined" && properties.indexOf(shorthand) < 0) {
                    properties.push(shorthand);
                }
            }
        }
        return properties;
    })()
}

WebInspector.CSS.properties.startsWith = function startsWith(str)
{
    return this.filter(function(property){
        return property.indexOf(str) === 0;
    });
};

WebInspector.CSS.properties.firstStartsWith = function firstStartsWith(str)
{
    if (!str)
        return "";
    for (var i = 0; i < this.length; ++i) {
        if (this[i].indexOf(str) === 0) {
            return this[i];
        }
    }
    return "";
};
