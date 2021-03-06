/**
 * Copyright © 2013 - 2017 WaveMaker, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.wavemaker.runtime.data.util;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.hibernate.HibernateException;
import org.hibernate.Query;
import org.hibernate.Session;
import org.hibernate.type.AbstractStandardBasicType;
import org.hibernate.type.CustomType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.orm.hibernate4.HibernateCallback;
import org.springframework.orm.hibernate4.HibernateTemplate;

import com.wavemaker.commons.data.type.WMPersistentLocalDateTime;
import com.wavemaker.commons.util.Tuple;
import com.wavemaker.runtime.data.dao.util.QueryHelper;
import com.wavemaker.runtime.data.filter.LegacyQueryFilterInterceptor;
import com.wavemaker.runtime.data.filter.QueryInterceptor;
import com.wavemaker.runtime.data.filter.WMQueryFunctionInterceptor;
import com.wavemaker.runtime.data.filter.WMQueryInfo;
import com.wavemaker.runtime.data.model.JavaType;
import com.wavemaker.runtime.data.model.ReferenceType;
import com.wavemaker.runtime.data.model.returns.FieldType;
import com.wavemaker.runtime.data.model.returns.ReturnProperty;
import com.wavemaker.runtime.data.spring.WMPageImpl;

public class HQLQueryUtils {

    private static final String FROM = " from ";
    private static final String WHERE = " where ";
    private static final String ORDER_BY = " order by ";

    private static final List<QueryInterceptor> interceptors = Arrays.asList(
            new LegacyQueryFilterInterceptor(),
            new WMQueryFunctionInterceptor());

    public static Tuple.Two<Query, Map<String, Object>> createHQLQuery(
            String entityClass, String query, Pageable pageable, Session
            session) {
        final WMQueryInfo queryInfo = buildHQL(entityClass, query, pageable);

        Query hqlQuery = session.createQuery(queryInfo.getQuery());

        if (pageable != null) {
            hqlQuery.setFirstResult(pageable.getOffset());
            hqlQuery.setMaxResults(pageable.getPageSize());
        }
        return new Tuple.Two<>(hqlQuery, queryInfo.getParameters());
    }

    public static Page executeHQLQuery(
            final Query hqlQuery, final Map<String, Object> params, final Pageable pageable,
            final HibernateTemplate template) {

        return template.execute(new HibernateCallback<Page<Object>>() {
            public Page<Object> doInHibernate(Session session) throws HibernateException {
                QueryHelper.setResultTransformer(hqlQuery, Object.class);
                QueryHelper.configureParameters(hqlQuery, params);
                if (pageable != null) {
                    Long count = QueryHelper.getQueryResultCount(hqlQuery.getQueryString(), params, false, template);
                    return new WMPageImpl(hqlQuery.list(), pageable, count);
                }
                return new WMPageImpl(hqlQuery.list());
            }
        });
    }

    public static List<ReturnProperty> extractMetaForHql(final Query query) {
        final org.hibernate.type.Type[] returnTypes = query.getReturnTypes();
        final String[] returnAliases = query.getReturnAliases();
        List<ReturnProperty> properties = new ArrayList<>(returnTypes.length);
        for (int i = 0; i < returnTypes.length; i++) {
            final org.hibernate.type.Type type = returnTypes[i];

            ReturnProperty property = new ReturnProperty();
            if (returnAliases != null && returnAliases.length >= i) {
                property.setName(returnAliases[i]);
            }

            FieldType fieldType = new FieldType();
            String typeRef = type.getName();
            if (type.isCollectionType()) {
                fieldType.setList(true);
            }
            if (type.isAssociationType()) {
                fieldType.setType(ReferenceType.ENTITY);
            } else {
                fieldType.setType(ReferenceType.PRIMITIVE);
            }
            if (type instanceof AbstractStandardBasicType) {
                final Class typeClass = ((AbstractStandardBasicType) type).getJavaTypeDescriptor().getJavaTypeClass();
                typeRef = typeClass.getCanonicalName();
            } else if (type instanceof CustomType) { // TODO remove this when type is as expected
                if (typeRef.equals(WMPersistentLocalDateTime.class.getName())) {
                    typeRef = JavaType.DATETIME.getClassName();
                }
            }

            fieldType.setTypeRef(typeRef);
            property.setFieldType(fieldType);

            properties.add(property);
        }
        return properties;
    }

    public static String buildOrderByClause(Sort sort) {
        StringBuilder orderBy = new StringBuilder(ORDER_BY);
        Iterator<Sort.Order> orderItr = sort.iterator();
        while (orderItr.hasNext()) {
            Sort.Order order = orderItr.next();
            orderBy.append(" ")
                    .append(order.getProperty())
                    .append(" ")
                    .append(order.getDirection());
            if (orderItr.hasNext()) {
                orderBy.append(",");
            }
        }
        return orderBy.toString();
    }

    private static WMQueryInfo buildHQL(String entityClass, String query, Pageable pageable) {
        WMQueryInfo queryInfo = new WMQueryInfo(query);

        String queryFilter = StringUtils.EMPTY;
        String orderBy = StringUtils.EMPTY;
        if (StringUtils.isNotBlank(queryInfo.getQuery())) {
            for (final QueryInterceptor interceptor : interceptors) {
                interceptor.intercept(queryInfo);
            }
            queryFilter = WHERE + queryInfo.getQuery();
        }
        if (isSortAppliedOnPageable(pageable)) {
            orderBy = buildOrderByClause(pageable.getSort());
        }

        queryInfo.setQuery(FROM + entityClass + queryFilter + orderBy);

        return queryInfo;
    }

    public static boolean isSortAppliedOnPageable(Pageable pageable) {
        return (pageable != null) && (pageable.getSort() != null);
    }
}
