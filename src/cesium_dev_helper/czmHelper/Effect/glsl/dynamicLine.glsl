uniform sampler2D image;

czm_material czm_getMaterial(czm_materialInput materialInput) {
    czm_material material = czm_getDefaultMaterial(materialInput);
    vec2 st = materialInput.st;

    if(texture(image, vec2(0.0, 0.0)).a == 1.0) {
        discard;
    } else {
        material.alpha = texture(image, vec2(1.0 - fract(time - st.s), st.t)).a * color.a;
    }

    material.diffuse = max(color.rgb * material.alpha * 3.0, color.rgb);

    return material;
}
