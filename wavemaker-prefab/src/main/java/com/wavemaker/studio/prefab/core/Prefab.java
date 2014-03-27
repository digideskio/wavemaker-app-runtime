/*
 * Copyright (C) 2012-2013 CloudJee, Inc. All rights reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package com.wavemaker.studio.prefab.core;

import org.apache.commons.lang.Validate;
import org.apache.commons.lang.builder.EqualsBuilder;
import org.apache.commons.lang.builder.HashCodeBuilder;

/**
 * Barebones prefab class, holds a {@link ClassLoader} that can load packaged {@link Class}es.
 * 
 * A prefab is initially in the ENABLED state, during which its {@link Class}es can be of service.
 * When a prefab is in the DISABLED state, its {@link Class}es can no longer be used and are likely
 * to be garbage collected.
 * 
 * @author Dilip Kumar
 */
public class Prefab {

    private final String name;
    private ClassLoader classLoader;
    private State state;

    /**
     * Creates a new <code>Prefab</code> with the specified name and classloader.
     * 
     * @param name name, usually the name of the source
     * @param classLoader {@link ClassLoader} to be used to load packaged classes
     */
    public Prefab(final String name, final ClassLoader classLoader) {
        Validate.notEmpty(name, "Prefab: Prefab name should not be empty");
        Validate.notNull(classLoader, "Prefab: ClassLoader should not be null");

        this.name = name;
        this.classLoader = classLoader;
        state = State.ENABLED;
    }

    /**
     * @return the name
     */
    public String getName() {
        return name;
    }

    /**
     * @return the class loader
     */
    public ClassLoader getClassLoader() {
        return classLoader;
    }

    /**
     * Disable this prefab. A prefab once disabled, cannot be enabled again.
     */
    public void disable() {
        classLoader = null;

        state = State.DISABLED;
    }

    /**
     * Checks whether this prefab is enabled.
     * 
     * @return test true, if enabled
     */
    public boolean isEnabled() {
        return state == State.ENABLED;
    }

    @Override
    public int hashCode() {
        return new HashCodeBuilder().append(name)
        .append(classLoader)
        .toHashCode();
    }

    @Override
    public boolean equals(final Object that) {
        if (that == this) {
            return true;
        } else if (that == null || that.getClass() != this.getClass()) {
            return false;
        }

        Prefab prefab = (Prefab) that;

        return new EqualsBuilder().append(name, prefab.name)
        .append(classLoader, prefab.classLoader)
        .isEquals();
    }

    @Override
    public String toString() {
        return name + " (" + state + ")";
    }

    /**
     * Valid states of prefab.
     */
    private static enum State {
        ENABLED, DISABLED
    }
}
