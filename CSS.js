WebInspector.CSS = {
    properties: (function getCSSProperties(){
        var properties = Array.convert(document.defaultView.getComputedStyle(document.documentElement, ''));
        // Add shorthands
        for (var i=0; i<properties.length; i++) {
            var s = properties[i].split('-');
            var j = s.length;
            while (--j) {
                var prop = s.slice(0, j).join('-');
                if (typeof document.documentElement.style[prop] !== 'undefined' && properties.indexOf(prop) < 0) {
                    properties.push(prop);
                }
            }
        }
        return properties;
    })()
}

WebInspector.CSS.properties.startsWith = function startsWith(str)
{
    return this.filter(function(prop){
        return prop.indexOf(str) === 0
    });
};

WebInspector.CSS.properties.firstStartsWith = function firstStartsWith(str)
{
    if (!str) return '';
    for (var i=0; i<this.length; i++) {
        if (this[i].indexOf(str) === 0) {
            return this[i];
        }
    }
    return '';
};